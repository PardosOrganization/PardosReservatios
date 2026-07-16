/**
 * svc-mozo/src/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Microservicio Mozo — Pardos Chicken
 * Servicio de solo lectura para mozos: consulta de reservas del día,
 * estado de mesas y notificaciones de cocina.
 *
 * En producción, este servicio consultaría a svc-anfitriona y svc-cocina
 * internamente vía el ALB o Service Discovery. Para esta versión standalone,
 * mantiene su propia copia de datos de mesas y reservas del día.
 *
 * Endpoints:
 *   GET  /health                    → Health check (ALB / ECS)
 *   GET  /api/reservations/today    → Reservas activas de hoy
 *   GET  /api/tables                → Estado actual de mesas
 *   GET  /api/notifications         → Notificaciones de cocina (tickets listos)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from 'express'
import cors from 'cors'
import client from 'prom-client'
import { httpMetricsMiddleware, notificacionesLeidas } from './metrics.js'

const app = express()
const PORT = process.env.PORT || 8080

// Habilitar recolección de métricas por defecto
client.collectDefaultMetrics({ register: client.register })

app.use(cors())
app.use(express.json())

// Endpoint de métricas de Prometheus (antes del middleware ALB)
app.get(['/metrics', '/mozo/metrics'], async (req, res) => {
  res.setHeader('Content-Type', client.register.contentType)
  res.send(await client.register.metrics())
})



// Middleware para soportar prefijos de enrutamiento del ALB en AWS
app.use((req, res, next) => {
  const prefixes = ['/anfitriona', '/mozo', '/caja', '/cocina']
  for (const p of prefixes) {
    if (req.url.startsWith(p)) {
      req.url = req.url.slice(p.length)
      break
    }
  }
  next()
})

  // Removed metrics endpoint from here as it was moved above ALB middleware

// Instrumentación HTTP para Prometheus (después de normalizar el prefijo del ALB)
app.use(httpMetricsMiddleware)

// ── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]

// ── Datos en memoria (subset para el mozo) ──────────────────────────────────

const TABLES = Array.from({ length: 20 }, (_, i) => ({
  id: `T${String(i + 1).padStart(2, '0')}`,
  number: i + 1,
  capacity: [2, 2, 4, 4, 4, 6, 6, 2, 4, 4, 6, 2, 4, 8, 4, 6, 2, 4, 4, 6][i],
  zone: i < 8 ? 'Salón Principal' : i < 14 ? 'Terraza' : 'VIP',
  isAvailable: true,
}))

let reservations = [
  {
    id: 'R001', clientName: 'María García', clientPhone: '987654321',
    date: todayStr(), time: '13:00', guests: 4, tableId: 'T03',
    status: 'pending', notes: 'Cumpleaños, pedir torta de chocolate',
    occasion: 'Cumpleaños',
  },
  {
    id: 'R002', clientName: 'Roberto Silva', clientPhone: '912345678',
    date: todayStr(), time: '14:30', guests: 2, tableId: 'T01',
    status: 'seated', notes: '',
  },
  {
    id: 'R003', clientName: 'Patricia Flores', clientPhone: '943211234',
    date: todayStr(), time: '19:00', guests: 6, tableId: 'T06',
    status: 'pending', notes: 'Cena de aniversario',
    occasion: 'Aniversario',
  },
  {
    id: 'R004', clientName: 'Carlos Quispe', clientPhone: '956781234',
    date: todayStr(), time: '20:30', guests: 8, tableId: 'T14',
    status: 'pending', notes: 'Reunión de empresa',
    occasion: 'Reunión',
  },
  {
    id: 'R005', clientName: 'Lucia Mendoza', clientPhone: '999888777',
    date: todayStr(), time: '21:00', guests: 4, tableId: 'T15',
    status: 'pending', notes: 'Mesa VIP solicitada',
  },
]

// Simulación de notificaciones de cocina
let notifications = [
  {
    id: 'N001', type: 'ticket_ready', ticketId: 'TK001',
    tableId: 'T01', message: 'Pedido de Mesa 1 listo para servir',
    read: false, createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
]

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'svc-mozo', timestamp: new Date().toISOString() })
})

// ══════════════════════════════════════════════════════════════════════════════
// RESERVAS DEL DÍA (solo lectura)
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/reservations/today — Reservas activas de hoy */
app.get('/api/reservations/today', (_req, res) => {
  const today = todayStr()
  res.json(reservations.filter(
    r => r.date === today && r.status !== 'cancelled' && r.status !== 'rejected'
  ))
})

// ══════════════════════════════════════════════════════════════════════════════
// MESAS (solo lectura)
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/tables — Estado de mesas con ocupación */
app.get('/api/tables', (_req, res) => {
  const today = todayStr()
  const occupiedTableIds = reservations
    .filter(r => r.date === today && (r.status === 'seated' || r.status === 'pending'))
    .map(r => r.tableId)

  const tablesWithStatus = TABLES.map(t => ({
    ...t,
    isAvailable: !occupiedTableIds.includes(t.id),
  }))
  res.json(tablesWithStatus)
})

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICACIONES
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/notifications — Notificaciones pendientes del mozo */
app.get('/api/notifications', (_req, res) => {
  res.json(notifications)
})

/** PATCH /api/notifications/:id/read — Marcar notificación como leída */
app.patch('/api/notifications/:id/read', (req, res) => {
  const idx = notifications.findIndex(n => n.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Notificación no encontrada' })

  notifications[idx].read = true
  notificacionesLeidas.inc()
  res.json(notifications[idx])
})

const initialReservations = JSON.parse(JSON.stringify(reservations))
const initialNotifications = JSON.parse(JSON.stringify(notifications))

// ── Exportacion ──────────────────────────────────────────────────────────────
export function resetState() {
  reservations = JSON.parse(JSON.stringify(initialReservations))
  notifications = JSON.parse(JSON.stringify(initialNotifications))
}

export {
  todayStr,
  TABLES,
  reservations,
  notifications
}

export default app

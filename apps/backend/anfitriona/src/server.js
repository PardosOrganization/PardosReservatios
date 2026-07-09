/**
 * svc-anfitriona/src/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Microservicio Anfitriona — Pardos Chicken
 * Gestiona reservas, mesas y clientes.
 *
 * Endpoints:
 *   GET    /health                      → Health check (ALB / ECS)
 *   GET    /api/reservations            → Listar todas las reservas
 *   GET    /api/reservations/requested  → Solicitudes pendientes de aprobación
 *   GET    /api/reservations/today      → Reservas activas de hoy
 *   POST   /api/reservations            → Crear nueva reserva
 *   PATCH  /api/reservations/:id        → Actualizar reserva (estado, datos)
 *   GET    /api/clients                 → Listar clientes
 *   POST   /api/clients                 → Registrar cliente
 *   PATCH  /api/clients/:id             → Actualizar cliente
 *   GET    /api/tables                  → Estado de mesas
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import client from 'prom-client'

const app = express()
const PORT = process.env.PORT || 8080

// Habilitar recolección de métricas por defecto
client.collectDefaultMetrics({ register: client.register })

app.use(cors())
app.use(express.json())

// Endpoint de métricas de Prometheus
app.get('/metrics', async (req, res) => {
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

// ── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]
const daysAgo  = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ── Datos en memoria (seed) ─────────────────────────────────────────────────

const TABLES = Array.from({ length: 20 }, (_, i) => ({
  id: `T${String(i + 1).padStart(2, '0')}`,
  number: i + 1,
  capacity: [2, 2, 4, 4, 4, 6, 6, 2, 4, 4, 6, 2, 4, 8, 4, 6, 2, 4, 4, 6][i],
  zone: i < 8 ? 'Salón Principal' : i < 14 ? 'Terraza' : 'VIP',
  isAvailable: true,
}))

let reservations = [
  // ── HOY — activas
  {
    id: 'R001', clientId: 'C001',
    clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
    date: todayStr(), time: '13:00', guests: 4, tableId: 'T03',
    status: 'pending',
    notes: 'Cumpleaños, pedir torta de chocolate', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: 'Cumpleaños',
  },
  {
    id: 'R002', clientId: 'C002',
    clientName: 'Roberto Silva', clientPhone: '912345678', clientEmail: 'roberto@email.com',
    date: todayStr(), time: '14:30', guests: 2, tableId: 'T01',
    status: 'seated',
    notes: '', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R003', clientId: 'C004',
    clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
    date: todayStr(), time: '19:00', guests: 6, tableId: 'T06',
    status: 'pending',
    notes: 'Cena de aniversario', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: 'Aniversario',
  },
  {
    id: 'R004', clientId: 'C005',
    clientName: 'Carlos Quispe', clientPhone: '956781234', clientEmail: 'carlos_q@email.com',
    date: todayStr(), time: '20:30', guests: 8, tableId: 'T14',
    status: 'pending',
    notes: 'Reunión de empresa', createdAt: new Date().toISOString(),
    createdBy: 'u002', occasion: 'Reunión',
  },
  {
    id: 'R005', clientId: 'C006',
    clientName: 'Lucia Mendoza', clientPhone: '999888777', clientEmail: 'lucia_m@email.com',
    date: todayStr(), time: '21:00', guests: 4, tableId: 'T15',
    status: 'pending',
    notes: 'Mesa VIP solicitada', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: '',
  },
  // ── AYER
  {
    id: 'R006', clientId: 'C003',
    clientName: 'Ana López', clientPhone: '998877665', clientEmail: 'ana@email.com',
    date: daysAgo(1), time: '13:30', guests: 3, tableId: 'T05',
    status: 'completed',
    notes: '', createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'u004', occasion: 'Almuerzo familiar',
  },
  {
    id: 'R007', clientId: 'C007',
    clientName: 'Jorge Castillo', clientPhone: '988112233', clientEmail: 'jorge_c@email.com',
    date: daysAgo(1), time: '14:00', guests: 2, tableId: 'T02',
    status: 'completed',
    notes: '', createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'u002', occasion: '',
  },
  {
    id: 'R008', clientId: 'C008',
    clientName: 'Isabel Torres', clientPhone: '912233445', clientEmail: 'isabel@email.com',
    date: daysAgo(1), time: '20:00', guests: 5, tableId: 'T11',
    status: 'completed',
    notes: 'Solicitar mesa tranquila', createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'u004', occasion: 'Cena',
  },
  {
    id: 'R009', clientId: 'C009',
    clientName: 'Pedro Vásquez', clientPhone: '977665544', clientEmail: 'pedro@email.com',
    date: daysAgo(1), time: '19:30', guests: 4, tableId: 'T10',
    status: 'cancelled', cancelReason: 'Cliente llamó para cancelar',
    notes: '', createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'u002', occasion: '',
  },
  // ── HACE 2 DÍAS
  {
    id: 'R010', clientId: 'C001',
    clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
    date: daysAgo(2), time: '13:00', guests: 4, tableId: 'T04',
    status: 'completed',
    notes: '', createdAt: new Date(Date.now() - 172800000).toISOString(),
    createdBy: 'u004', occasion: 'Almuerzo familiar',
  },
  {
    id: 'R011', clientId: 'C010',
    clientName: 'Sandra Reyes', clientPhone: '944332211', clientEmail: 'sandra@email.com',
    date: daysAgo(2), time: '20:00', guests: 2, tableId: 'T01',
    status: 'no_show',
    notes: '', createdAt: new Date(Date.now() - 172800000).toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R012', clientId: 'C004',
    clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
    date: daysAgo(2), time: '14:30', guests: 3, tableId: 'T07',
    status: 'completed',
    notes: '', createdAt: new Date(Date.now() - 172800000).toISOString(),
    createdBy: 'u004', occasion: '',
  },
]

let clients = [
  {
    id: 'C001', name: 'María García', phone: '987654321', email: 'maria@email.com',
    dni: '45678901', birthday: '1990-03-15',
    preferences: 'Sin picante, mesa de ventana', allergies: 'Ninguna',
    totalVisits: 12, totalReservations: 13, lastVisit: '2026-04-02',
    registeredAt: '2025-01-10T10:00:00Z',
    notes: 'Cliente frecuente, viene con familia. Le gusta el pollo a la brasa entero.',
    vip: true,
  },
  {
    id: 'C002', name: 'Roberto Silva', phone: '912345678', email: 'roberto@email.com',
    dni: '32145678', birthday: '1985-07-22',
    preferences: 'Mesa interior, cerca de la ventana', allergies: 'Mariscos',
    totalVisits: 5, totalReservations: 6, lastVisit: '2026-04-01',
    registeredAt: '2026-01-05T14:00:00Z',
    notes: 'Alérgico a mariscos.', vip: false,
  },
  {
    id: 'C003', name: 'Ana López', phone: '998877665', email: 'ana@email.com',
    dni: '56789012', birthday: '1995-11-08',
    preferences: 'Silla alta para bebé, mesa amplia', allergies: 'Gluten',
    totalVisits: 15, totalReservations: 16, lastVisit: '2026-04-02',
    registeredAt: '2024-06-01T09:00:00Z',
    notes: 'Viene siempre con su bebé. Alergia al gluten confirmada.', vip: true,
  },
  {
    id: 'C004', name: 'Patricia Flores', phone: '943211234', email: 'patricia@email.com',
    dni: '67890123', birthday: '1988-05-20',
    preferences: 'Mesa tranquila, lejos del área de barra', allergies: 'Ninguna',
    totalVisits: 8, totalReservations: 9, lastVisit: '2026-04-01',
    registeredAt: '2025-03-15T11:00:00Z',
    notes: 'Suele celebrar aniversarios aquí.', vip: true,
  },
  {
    id: 'C005', name: 'Carlos Quispe', phone: '956781234', email: 'carlos_q@email.com',
    dni: '78901234', birthday: '1980-09-12',
    preferences: 'Reservas para grupos grandes', allergies: 'Ninguna',
    totalVisits: 6, totalReservations: 7, lastVisit: '2026-03-30',
    registeredAt: '2025-06-20T09:00:00Z',
    notes: 'Trae grupos corporativos.', vip: false,
  },
  {
    id: 'C006', name: 'Lucia Mendoza', phone: '999888777', email: 'lucia_m@email.com',
    dni: '89012345', birthday: '1992-02-14',
    preferences: 'Mesa VIP, decoración especial', allergies: 'Frutos secos',
    totalVisits: 10, totalReservations: 11, lastVisit: '2026-04-03',
    registeredAt: '2024-11-01T10:00:00Z',
    notes: 'Alergia a frutos secos.', vip: true,
  },
  {
    id: 'C007', name: 'Jorge Castillo', phone: '988112233', email: 'jorge_c@email.com',
    dni: '90123456', birthday: '1978-12-30',
    preferences: 'Mesa esquinera, carta sin cerdo', allergies: 'Cerdo',
    totalVisits: 4, totalReservations: 4, lastVisit: '2026-04-02',
    registeredAt: '2026-02-10T14:00:00Z', notes: '', vip: false,
  },
  {
    id: 'C008', name: 'Isabel Torres', phone: '912233445', email: 'isabel@email.com',
    dni: '01234567', birthday: '1993-06-18',
    preferences: 'Mesa con iluminación tenue', allergies: 'Ninguna',
    totalVisits: 7, totalReservations: 8, lastVisit: '2026-04-02',
    registeredAt: '2025-08-05T16:00:00Z',
    notes: 'Le encanta el pollo a la brasa.', vip: false,
  },
  {
    id: 'C009', name: 'Pedro Vásquez', phone: '977665544', email: 'pedro@email.com',
    dni: '12309876', birthday: '1975-03-05',
    preferences: 'Mesa exterior', allergies: 'Ninguna',
    totalVisits: 2, totalReservations: 3, lastVisit: '2026-04-02',
    registeredAt: '2026-03-01T10:00:00Z',
    notes: 'Canceló una reserva sin aviso previo.', vip: false,
  },
  {
    id: 'C010', name: 'Sandra Reyes', phone: '944332211', email: 'sandra@email.com',
    dni: '23410987', birthday: '1998-08-25',
    preferences: 'Sin preferencia especial', allergies: 'Lácteos',
    totalVisits: 1, totalReservations: 2, lastVisit: '2026-04-01',
    registeredAt: '2026-03-20T12:00:00Z',
    notes: 'No se presentó a una reserva. Intolerancia a lácteos.', vip: false,
  },
  {
    id: 'C011', name: 'Enrique Huamán', phone: '955443322', email: 'enrique@email.com',
    dni: '34521098', birthday: '1970-11-15',
    preferences: 'Mesa privada, reuniones de trabajo', allergies: 'Ninguna',
    totalVisits: 9, totalReservations: 10, lastVisit: '2026-03-31',
    registeredAt: '2024-09-15T09:00:00Z',
    notes: 'Socio de empresa.', vip: true,
  },
  {
    id: 'C012', name: 'Valeria Cruz', phone: '966554433', email: 'valeria@email.com',
    dni: '45632109', birthday: '1997-04-10',
    preferences: 'Decoración floral, música suave', allergies: 'Ninguna',
    totalVisits: 5, totalReservations: 5, lastVisit: '2026-03-30',
    registeredAt: '2025-10-01T11:00:00Z',
    notes: 'Hace cumpleaños aquí.', vip: false,
  },
]

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'svc-anfitriona', timestamp: new Date().toISOString() })
})

// ══════════════════════════════════════════════════════════════════════════════
// RESERVAS
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/reservations — Todas las reservas */
app.get('/api/reservations', (_req, res) => {
  res.json(reservations)
})

/** GET /api/reservations/requested — Solo solicitudes pendientes de aprobación */
app.get('/api/reservations/requested', (_req, res) => {
  res.json(reservations.filter(r => r.status === 'requested'))
})

/** GET /api/reservations/today — Reservas activas de hoy */
app.get('/api/reservations/today', (_req, res) => {
  const today = todayStr()
  res.json(reservations.filter(
    r => r.date === today && r.status !== 'cancelled' && r.status !== 'rejected'
  ))
})

/** GET /api/reservations/history — Historial (completed, cancelled, no_show, rejected) */
app.get('/api/reservations/history', (_req, res) => {
  const historical = ['completed', 'cancelled', 'no_show', 'rejected']
  res.json(reservations.filter(r => historical.includes(r.status)))
})

/** POST /api/reservations — Crear nueva reserva */
app.post('/api/reservations', (req, res) => {
  const data = req.body
  const newReservation = {
    ...data,
    id: `R${uuidv4().slice(0, 6).toUpperCase()}`,
    status: data.status || 'requested',
    createdAt: new Date().toISOString(),
    source: data.source || 'system',
  }
  reservations.unshift(newReservation)
  console.log(`[INFO] Nueva reserva creada con éxito. ID: ${newReservation.id}, Cliente: ${newReservation.clientName}, Personas: ${newReservation.guests}, Mesa: ${newReservation.tableId || 'Pendiente'}`)
  res.status(201).json(newReservation)
})

/** PATCH /api/reservations/:id — Actualizar reserva */
app.patch('/api/reservations/:id', (req, res) => {
  const { id } = req.params
  const updates = req.body
  const idx = reservations.findIndex(r => r.id === id)
  if (idx === -1) return res.status(404).json({ error: 'Reserva no encontrada' })

  reservations[idx] = {
    ...reservations[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  res.json(reservations[idx])
})

/** DELETE /api/reservations/:id — Eliminar reserva */
app.delete('/api/reservations/:id', (req, res) => {
  const { id } = req.params
  const idx = reservations.findIndex(r => r.id === id)
  if (idx === -1) return res.status(404).json({ error: 'Reserva no encontrada' })

  reservations.splice(idx, 1)
  res.status(204).end()
})

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/clients — Listar todos los clientes */
app.get('/api/clients', (req, res) => {
  const { q } = req.query
  if (q && q.length >= 2) {
    const query = q.toLowerCase()
    return res.json(clients.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.phone?.includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.dni?.includes(query)
    ))
  }
  res.json(clients)
})

/** GET /api/clients/:id — Obtener cliente por ID */
app.get('/api/clients/:id', (req, res) => {
  const client = clients.find(c => c.id === req.params.id)
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' })
  res.json(client)
})

/** POST /api/clients — Registrar nuevo cliente */
app.post('/api/clients', (req, res) => {
  const data = req.body
  const newClient = {
    ...data,
    id: `C${uuidv4().slice(0, 6).toUpperCase()}`,
    totalVisits: 0,
    totalReservations: 0,
    lastVisit: null,
    registeredAt: new Date().toISOString(),
    vip: false,
  }
  clients.unshift(newClient)
  res.status(201).json(newClient)
})

/** PATCH /api/clients/:id — Actualizar cliente */
app.patch('/api/clients/:id', (req, res) => {
  const { id } = req.params
  const updates = req.body
  const idx = clients.findIndex(c => c.id === id)
  if (idx === -1) return res.status(404).json({ error: 'Cliente no encontrado' })

  clients[idx] = { ...clients[idx], ...updates, updatedAt: new Date().toISOString() }
  res.json(clients[idx])
})

/** POST /api/clients/:id/visit — Incrementar visitas */
app.post('/api/clients/:id/visit', (req, res) => {
  const idx = clients.findIndex(c => c.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Cliente no encontrado' })

  clients[idx].totalVisits = (clients[idx].totalVisits || 0) + 1
  clients[idx].lastVisit = todayStr()
  res.json(clients[idx])
})

// ══════════════════════════════════════════════════════════════════════════════
// MESAS
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/tables — Estado actual de mesas */
app.get('/api/tables', (_req, res) => {
  // Marcar mesas ocupadas según reservas activas de hoy
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

// ── Arranque ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏠 svc-anfitriona escuchando en http://0.0.0.0:${PORT}`)
  console.log(`   ${reservations.length} reservas · ${clients.length} clientes · ${TABLES.length} mesas cargadas`)
})

/**
 * svc-cocina/src/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Microservicio Cocina — Pardos Chicken
 * Gestiona tickets de pedidos, estados de preparación y menú.
 *
 * Endpoints:
 *   GET    /health                    → Health check (ALB / ECS)
 *   GET    /api/menu                  → Carta del restaurante
 *   GET    /api/tickets               → Listar todos los tickets
 *   GET    /api/tickets/active        → Tickets activos (no servidos)
 *   GET    /api/tickets/stats         → Contadores por estado
 *   POST   /api/tickets               → Crear nuevo ticket
 *   PATCH  /api/tickets/:id/status    → Cambiar estado de ticket
 *   PATCH  /api/tickets/:id           → Actualizar items/notas de ticket
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import client from 'prom-client'
import { httpMetricsMiddleware, ticketsCreados, ticketsCambiosEstado } from './metrics.js'

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

// Instrumentación HTTP para Prometheus (después de normalizar el prefijo del ALB)
app.use(httpMetricsMiddleware)

// ── Estados del ticket ──────────────────────────────────────────────────────
const TICKET_STATUS = {
  PENDING:   'pending',
  PREPARING: 'preparing',
  READY:     'ready',
  SERVED:    'served',
}

// ── Menú del restaurante ────────────────────────────────────────────────────
const MENU_ITEMS = [
  { id: 'M01', name: 'Pollo a la Brasa 1/4',    category: 'Principal',      time: 20, price: 28.00 },
  { id: 'M02', name: 'Pollo a la Brasa 1/2',    category: 'Principal',      time: 25, price: 48.00 },
  { id: 'M03', name: 'Pollo a la Brasa Entero',  category: 'Principal',      time: 35, price: 88.00 },
  { id: 'M04', name: 'Papas fritas',              category: 'Acompañamiento', time: 10, price:  9.00 },
  { id: 'M05', name: 'Ensalada fresca',           category: 'Acompañamiento', time:  5, price:  8.00 },
  { id: 'M06', name: 'Cremas surtidas',           category: 'Acompañamiento', time:  2, price:  4.00 },
  { id: 'M07', name: 'Chicha morada jarra',       category: 'Bebida',         time:  3, price: 12.00 },
  { id: 'M08', name: 'Gaseosa 1.5L',              category: 'Bebida',         time:  2, price:  9.00 },
  { id: 'M09', name: 'Agua mineral 625ml',        category: 'Bebida',         time:  1, price:  4.50 },
  { id: 'M10', name: 'Anticuchos (6 unid.)',      category: 'Entrada',        time: 15, price: 22.00 },
  { id: 'M11', name: 'Choclo con queso',          category: 'Entrada',        time:  8, price: 10.00 },
  { id: 'M12', name: 'Causa a la limeña',         category: 'Entrada',        time:  8, price: 14.00 },
  { id: 'M13', name: 'Torta de chocolate',        category: 'Postre',         time:  5, price: 18.00 },
  { id: 'M14', name: 'Helado 2 bolas',            category: 'Postre',         time:  3, price: 10.00 },
]

// ── Datos en memoria (seed) ─────────────────────────────────────────────────

let tickets = [
  {
    id: 'TK001',
    tableId: 'T01',
    clientName: 'Roberto Silva',
    guests: 2,
    status: TICKET_STATUS.PREPARING,
    items: [
      { menuId: 'M01', name: 'Pollo a la Brasa 1/4',  qty: 2, price: 28.00, notes: '' },
      { menuId: 'M04', name: 'Papas fritas',           qty: 2, price:  9.00, notes: 'Extra crujiente' },
      { menuId: 'M07', name: 'Chicha morada jarra',    qty: 1, price: 12.00, notes: '' },
    ],
    priority: 'normal',
    notes: '',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: 'TK002',
    tableId: 'T03',
    clientName: 'María García',
    guests: 4,
    status: TICKET_STATUS.PENDING,
    items: [
      { menuId: 'M02', name: 'Pollo a la Brasa 1/2',  qty: 2, price: 48.00, notes: '' },
      { menuId: 'M04', name: 'Papas fritas',           qty: 4, price:  9.00, notes: '' },
      { menuId: 'M10', name: 'Anticuchos (6 unid.)',   qty: 1, price: 22.00, notes: '' },
      { menuId: 'M08', name: 'Gaseosa 1.5L',           qty: 2, price:  9.00, notes: '' },
      { menuId: 'M13', name: 'Torta de chocolate',     qty: 1, price: 18.00, notes: 'Con vela de cumpleaños' },
    ],
    priority: 'high',
    notes: 'Cliente cumpleañeros — mesa VIP',
    createdAt: new Date(Date.now() - 3 * 60000).toISOString(),
  },
]

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'svc-cocina', timestamp: new Date().toISOString() })
})

// ══════════════════════════════════════════════════════════════════════════════
// MENÚ
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/menu — Carta completa del restaurante */
app.get('/api/menu', (_req, res) => {
  res.json(MENU_ITEMS)
})

/** GET /api/menu/categories — Categorías únicas del menú */
app.get('/api/menu/categories', (_req, res) => {
  const categories = [...new Set(MENU_ITEMS.map(m => m.category))]
  res.json(categories)
})

// ══════════════════════════════════════════════════════════════════════════════
// TICKETS
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/tickets — Todos los tickets */
app.get('/api/tickets', (_req, res) => {
  res.json(tickets)
})

/** GET /api/tickets/active — Tickets activos (no servidos) */
app.get('/api/tickets/active', (_req, res) => {
  res.json(tickets.filter(t => t.status !== TICKET_STATUS.SERVED))
})

/** GET /api/tickets/stats — Contadores por estado */
app.get('/api/tickets/stats', (_req, res) => {
  res.json({
    total:     tickets.length,
    pending:   tickets.filter(t => t.status === TICKET_STATUS.PENDING).length,
    preparing: tickets.filter(t => t.status === TICKET_STATUS.PREPARING).length,
    ready:     tickets.filter(t => t.status === TICKET_STATUS.READY).length,
    served:    tickets.filter(t => t.status === TICKET_STATUS.SERVED).length,
  })
})

/** POST /api/tickets — Crear nuevo ticket */
app.post('/api/tickets', (req, res) => {
  const data = req.body
  const newTicket = {
    ...data,
    id: `TK${uuidv4().slice(0, 4).toUpperCase()}`,
    status: TICKET_STATUS.PENDING,
    createdAt: new Date().toISOString(),
  }
  tickets.unshift(newTicket)
  ticketsCreados.inc({ priority: newTicket.priority || 'normal' })
  res.status(201).json(newTicket)
})

/** PATCH /api/tickets/:id/status — Cambiar estado de ticket */
app.patch('/api/tickets/:id/status', (req, res) => {
  const { id } = req.params
  const { status } = req.body
  const validStatuses = Object.values(TICKET_STATUS)

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`,
    })
  }

  const idx = tickets.findIndex(t => t.id === id)
  if (idx === -1) return res.status(404).json({ error: 'Ticket no encontrado' })

  tickets[idx] = { ...tickets[idx], status, updatedAt: new Date().toISOString() }
  ticketsCambiosEstado.inc({ status })
  res.json(tickets[idx])
})

/** PATCH /api/tickets/:id — Actualizar items o notas de un ticket */
app.patch('/api/tickets/:id', (req, res) => {
  const { id } = req.params
  const updates = req.body
  const idx = tickets.findIndex(t => t.id === id)
  if (idx === -1) return res.status(404).json({ error: 'Ticket no encontrado' })

  tickets[idx] = { ...tickets[idx], ...updates, updatedAt: new Date().toISOString() }
  res.json(tickets[idx])
})

const initialTickets = JSON.parse(JSON.stringify(tickets))

// ── Exportacion ──────────────────────────────────────────────────────────────
export function resetState() {
  tickets = JSON.parse(JSON.stringify(initialTickets))
}

export {
  TICKET_STATUS,
  MENU_ITEMS,
  tickets
}

export default app

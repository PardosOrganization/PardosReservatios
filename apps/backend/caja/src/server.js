/**
 * svc-caja/src/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Microservicio Caja — Pardos Chicken
 * Gestiona cobros, pagos, turnos de caja y resúmenes financieros.
 *
 * Endpoints:
 *   GET    /health                → Health check (ALB / ECS)
 *   GET    /api/payments          → Listar pagos (filtrable por fecha)
 *   GET    /api/payments/today    → Pagos de hoy con totales
 *   POST   /api/payments          → Registrar nuevo cobro
 *   GET    /api/shift             → Estado del turno activo
 *   POST   /api/shift/open        → Abrir turno de caja
 *   POST   /api/shift/close       → Cerrar turno y obtener resumen
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import client from 'prom-client'
import { httpMetricsMiddleware, pagosRegistrados, pagosMontoSoles, turnosCaja } from './metrics.js'

const app = express()
const PORT = process.env.PORT || 8080

// Habilitar recolección de métricas por defecto
client.collectDefaultMetrics({ register: client.register })

app.use(cors())
app.use(express.json())

// Endpoint de métricas de Prometheus (antes del middleware ALB)
app.get(['/metrics', '/caja/metrics'], async (req, res) => {
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
const timeStr  = () => new Date().toTimeString().slice(0, 5)
const daysAgo  = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ── Métodos de pago ─────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { id: 'efectivo',      label: 'Efectivo',     icon: '💵' },
  { id: 'tarjeta',       label: 'Tarjeta',      icon: '💳' },
  { id: 'yape',          label: 'Yape / Plin',  icon: '📱' },
  { id: 'transferencia', label: 'Transferencia', icon: '🏦' },
]

// ── Datos en memoria (seed) ─────────────────────────────────────────────────

let payments = [
  { id: 'P001', reservationId: 'R001', clientName: 'María García',    amount: 110.00, method: 'tarjeta',       date: todayStr(), time: '14:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Pollada familiar + extras', status: 'paid', guests: 4 },
  { id: 'P002', reservationId: 'R002', clientName: 'Roberto Silva',   amount:  52.50, method: 'yape',          date: todayStr(), time: '15:45', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 2 },
  { id: 'P003', reservationId: 'R006', clientName: 'Ana López',       amount:  78.00, method: 'efectivo',      date: daysAgo(1), time: '14:15', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 3 },
  { id: 'P004', reservationId: 'R007', clientName: 'Jorge Castillo',  amount:  46.50, method: 'tarjeta',       date: daysAgo(1), time: '15:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 2 },
  { id: 'P005', reservationId: 'R008', clientName: 'Isabel Torres',   amount: 125.00, method: 'tarjeta',       date: daysAgo(1), time: '21:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Cena larga', status: 'paid', guests: 5 },
  { id: 'P006', reservationId: 'R010', clientName: 'María García',    amount:  96.00, method: 'efectivo',      date: daysAgo(2), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P007', reservationId: 'R012', clientName: 'Patricia Flores', amount:  65.00, method: 'yape',          date: daysAgo(2), time: '15:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 3 },
  { id: 'P008', reservationId: 'R013', clientName: 'Ana López',       amount: 135.00, method: 'tarjeta',       date: daysAgo(3), time: '13:45', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Grupo grande', status: 'paid', guests: 5 },
  { id: 'P009', reservationId: 'R014', clientName: 'Enrique Huamán',  amount: 190.00, method: 'transferencia', date: daysAgo(3), time: '20:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Corporativo', status: 'paid', guests: 6 },
  { id: 'P010', reservationId: 'R016', clientName: 'Carlos Quispe',   amount: 245.00, method: 'transferencia', date: daysAgo(5), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Aniversario empresa', status: 'paid', guests: 8 },
  { id: 'P011', reservationId: 'R017', clientName: 'Jorge Castillo',  amount:  88.00, method: 'tarjeta',       date: daysAgo(5), time: '21:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P012', reservationId: 'R018', clientName: 'Valeria Cruz',    amount:  72.00, method: 'yape',          date: daysAgo(5), time: '15:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Cumpleaños', status: 'paid', guests: 3 },
  { id: 'P013', reservationId: 'R019', clientName: 'María García',    amount:  98.00, method: 'efectivo',      date: daysAgo(7), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P014', reservationId: 'R020', clientName: 'Isabel Torres',   amount: 155.00, method: 'tarjeta',       date: daysAgo(7), time: '21:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Cena especial', status: 'paid', guests: 6 },
  { id: 'P015', reservationId: 'R021', clientName: 'Ana López',       amount:  48.00, method: 'yape',          date: daysAgo(10), time: '15:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 2 },
  { id: 'P016', reservationId: 'R022', clientName: 'Lucia Mendoza',   amount: 210.00, method: 'tarjeta',       date: daysAgo(10), time: '20:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Mesa VIP aniversario', status: 'paid', guests: 4 },
  { id: 'P017', reservationId: 'R023', clientName: 'Enrique Huamán',  amount: 145.00, method: 'transferencia', date: daysAgo(10), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Reunión', status: 'paid', guests: 5 },
  { id: 'P018', reservationId: 'R024', clientName: 'Patricia Flores', amount:  89.00, method: 'efectivo',      date: daysAgo(14), time: '21:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P019', reservationId: 'R025', clientName: 'Valeria Cruz',    amount: 165.00, method: 'tarjeta',       date: daysAgo(14), time: '15:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Almuerzo familiar grande', status: 'paid', guests: 6 },
]

let shift = null // Turno activo
const initialPayments = JSON.parse(JSON.stringify(payments))

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'svc-caja', timestamp: new Date().toISOString() })
})

// ══════════════════════════════════════════════════════════════════════════════
// PAGOS
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/payments — Listar pagos (opcionalmente filtrar por ?date=YYYY-MM-DD) */
app.get('/api/payments', (req, res) => {
  const { date } = req.query
  if (date) return res.json(payments.filter(p => p.date === date))
  res.json(payments)
})

/** GET /api/payments/today — Pagos de hoy con totales y desglose */
app.get('/api/payments/today', (_req, res) => {
  const today = todayStr()
  const todayPayments = payments.filter(p => p.date === today)
  const todayTotal = todayPayments.reduce((s, p) => s + p.amount, 0)

  const byMethod = {}
  for (const m of PAYMENT_METHODS) {
    byMethod[m.id] = todayPayments
      .filter(p => p.method === m.id)
      .reduce((s, p) => s + p.amount, 0)
  }

  res.json({
    payments: todayPayments,
    total: todayTotal,
    count: todayPayments.length,
    byMethod,
  })
})

/** GET /api/payments/methods — Métodos de pago disponibles */
app.get('/api/payments/methods', (_req, res) => {
  res.json(PAYMENT_METHODS)
})

/** POST /api/payments — Registrar nuevo cobro */
app.post('/api/payments', (req, res) => {
  const data = req.body
  if (!data.amount || data.amount <= 0 || !data.cashierId || !data.clientName) {
    return res.status(400).json({ error: 'Faltan datos obligatorios o el monto es invalido' })
  }
  const newPayment = {
    ...data,
    id: `P${uuidv4().slice(0, 6).toUpperCase()}`,
    date: todayStr(),
    time: timeStr(),
    status: 'paid',
  }
  payments.unshift(newPayment)
  pagosRegistrados.inc({ method: newPayment.method || 'desconocido' })
  pagosMontoSoles.inc({ method: newPayment.method || 'desconocido' }, newPayment.amount)
  res.status(201).json(newPayment)
})

/** PATCH /api/payments/:id/void — Anular una cuenta (acción del Líder) */
app.patch('/api/payments/:id/void', (req, res) => {
  const idx = payments.findIndex(p => p.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Pago no encontrado' })
  if (payments[idx].status === 'anulado') {
    return res.status(409).json({ error: 'El pago ya está anulado' })
  }
  const { voidReason = '', voidedBy = '' } = req.body || {}
  payments[idx] = {
    ...payments[idx],
    status: 'anulado',
    voidReason,
    voidedBy,
    voidedAt: new Date().toISOString(),
  }
  console.log(`[INFO] Cuenta anulada. ID: ${payments[idx].id}, Por: ${voidedBy}, Motivo: ${voidReason || 'sin motivo'}`)
  res.json(payments[idx])
})

// ══════════════════════════════════════════════════════════════════════════════
// TURNOS DE CAJA
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/shift — Estado del turno activo */
app.get('/api/shift', (_req, res) => {
  if (!shift) return res.json({ active: false, shift: null })
  res.json({ active: true, shift })
})

/** POST /api/shift/open — Abrir turno de caja */
app.post('/api/shift/open', (req, res) => {
  if (shift) return res.status(409).json({ error: 'Ya hay un turno abierto' })

  const { cashierId, cashierName, initialCash = 0 } = req.body
  shift = {
    id: `T${uuidv4().slice(0, 6).toUpperCase()}`,
    cashierId,
    cashierName,
    openedAt: new Date().toISOString(),
    closedAt: null,
    initialCash,
    status: 'open',
  }
  turnosCaja.inc({ accion: 'abierto' })
  res.status(201).json(shift)
})

/** POST /api/shift/close — Cerrar turno y obtener resumen */
app.post('/api/shift/close', (_req, res) => {
  if (!shift) return res.status(404).json({ error: 'No hay turno abierto' })

  const today = todayStr()
  const shiftPayments = payments.filter(
    p => p.cashierId === shift.cashierId && p.date === today && p.status !== 'anulado'
  )

  const summary = {
    ...shift,
    closedAt: new Date().toISOString(),
    status: 'closed',
    totalAmount: shiftPayments.reduce((s, p) => s + p.amount, 0),
    totalTx: shiftPayments.length,
    byMethod: {},
  }
  for (const m of PAYMENT_METHODS) {
    summary.byMethod[m.id] = shiftPayments
      .filter(p => p.method === m.id)
      .reduce((s, p) => s + p.amount, 0)
  }

  shift = null
  turnosCaja.inc({ accion: 'cerrado' })
  res.json(summary)
})

// ── Exportacion ──────────────────────────────────────────────────────────────
export function resetState() {
  shift = null
  payments = JSON.parse(JSON.stringify(initialPayments))
}

export {
  todayStr,
  daysAgo,
  PAYMENT_METHODS,
  payments,
  shift
}

export default app

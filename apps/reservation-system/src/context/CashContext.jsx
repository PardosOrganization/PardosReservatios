/**
 * src/context/CashContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de Caja — módulo exclusivo del Cajero.
 * Gestiona:
 *   - Cobros de reservas (genera tickets de venta)
 *   - Estado del turno de caja (apertura / cierre)
 *   - Resumen del turno: total cobrado, n° transacciones
 *   - Historial de pagos por turno y por fecha
 *
 * Métodos de pago soportados: Efectivo, Tarjeta, Yape/Plin, Transferencia
 * Los datos se persisten en localStorage (en producción → API).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { format, subDays } from 'date-fns'

// ── Métodos de pago ───────────────────────────────────────────────────────────
export const PAYMENT_METHODS = [
  { id: 'efectivo',     label: 'Efectivo',        icon: '💵' },
  { id: 'tarjeta',      label: 'Tarjeta',          icon: '💳' },
  { id: 'yape',         label: 'Yape / Plin',      icon: '📱' },
  { id: 'transferencia',label: 'Transferencia',    icon: '🏦' },
]

// ── Datos de ejemplo: pagos históricos ───────────────────────────────────────
const SAMPLE_PAYMENTS = [
  // HOY
  { id: 'P001', reservationId: 'R001', clientName: 'María García',      amount: 110.00, method: 'tarjeta',       date: format(new Date(), 'yyyy-MM-dd'), time: '14:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Pollada familiar + extras', status: 'paid', guests: 4 },
  { id: 'P002', reservationId: 'R002', clientName: 'Roberto Silva',     amount:  52.50, method: 'yape',          date: format(new Date(), 'yyyy-MM-dd'), time: '15:45', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 2 },
  // AYER
  { id: 'P003', reservationId: 'R006', clientName: 'Ana López',         amount:  78.00, method: 'efectivo',      date: format(subDays(new Date(),1), 'yyyy-MM-dd'), time: '14:15', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 3 },
  { id: 'P004', reservationId: 'R007', clientName: 'Jorge Castillo',    amount:  46.50, method: 'tarjeta',       date: format(subDays(new Date(),1), 'yyyy-MM-dd'), time: '15:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 2 },
  { id: 'P005', reservationId: 'R008', clientName: 'Isabel Torres',     amount: 125.00, method: 'tarjeta',       date: format(subDays(new Date(),1), 'yyyy-MM-dd'), time: '21:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Cena larga', status: 'paid', guests: 5 },
  // HACE 2 DÍAS
  { id: 'P006', reservationId: 'R010', clientName: 'María García',      amount:  96.00, method: 'efectivo',      date: format(subDays(new Date(),2), 'yyyy-MM-dd'), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P007', reservationId: 'R012', clientName: 'Patricia Flores',   amount:  65.00, method: 'yape',          date: format(subDays(new Date(),2), 'yyyy-MM-dd'), time: '15:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 3 },
  // HACE 3 DÍAS
  { id: 'P008', reservationId: 'R013', clientName: 'Ana López',         amount: 135.00, method: 'tarjeta',       date: format(subDays(new Date(),3), 'yyyy-MM-dd'), time: '13:45', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Grupo grande', status: 'paid', guests: 5 },
  { id: 'P009', reservationId: 'R014', clientName: 'Enrique Huamán',    amount: 190.00, method: 'transferencia', date: format(subDays(new Date(),3), 'yyyy-MM-dd'), time: '20:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Corporativo', status: 'paid', guests: 6 },
  // HACE 5 DÍAS
  { id: 'P010', reservationId: 'R016', clientName: 'Carlos Quispe',     amount: 245.00, method: 'transferencia', date: format(subDays(new Date(),5), 'yyyy-MM-dd'), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Aniversario empresa', status: 'paid', guests: 8 },
  { id: 'P011', reservationId: 'R017', clientName: 'Jorge Castillo',    amount:  88.00, method: 'tarjeta',       date: format(subDays(new Date(),5), 'yyyy-MM-dd'), time: '21:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P012', reservationId: 'R018', clientName: 'Valeria Cruz',      amount:  72.00, method: 'yape',          date: format(subDays(new Date(),5), 'yyyy-MM-dd'), time: '15:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Cumpleaños', status: 'paid', guests: 3 },
  // HACE 7 DÍAS
  { id: 'P013', reservationId: 'R019', clientName: 'María García',      amount:  98.00, method: 'efectivo',      date: format(subDays(new Date(),7), 'yyyy-MM-dd'), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P014', reservationId: 'R020', clientName: 'Isabel Torres',     amount: 155.00, method: 'tarjeta',       date: format(subDays(new Date(),7), 'yyyy-MM-dd'), time: '21:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Cena especial', status: 'paid', guests: 6 },
  // HACE 10 DÍAS
  { id: 'P015', reservationId: 'R021', clientName: 'Ana López',         amount:  48.00, method: 'yape',          date: format(subDays(new Date(),10), 'yyyy-MM-dd'), time: '15:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 2 },
  { id: 'P016', reservationId: 'R022', clientName: 'Lucia Mendoza',     amount: 210.00, method: 'tarjeta',       date: format(subDays(new Date(),10), 'yyyy-MM-dd'), time: '20:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Mesa VIP aniversario', status: 'paid', guests: 4 },
  { id: 'P017', reservationId: 'R023', clientName: 'Enrique Huamán',    amount: 145.00, method: 'transferencia', date: format(subDays(new Date(),10), 'yyyy-MM-dd'), time: '14:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Reunión', status: 'paid', guests: 5 },
  // HACE 14 DÍAS
  { id: 'P018', reservationId: 'R024', clientName: 'Patricia Flores',   amount:  89.00, method: 'efectivo',      date: format(subDays(new Date(),14), 'yyyy-MM-dd'), time: '21:00', cashierId: 'u002', cashierName: 'Lucia Torres', notes: '', status: 'paid', guests: 4 },
  { id: 'P019', reservationId: 'R025', clientName: 'Valeria Cruz',      amount: 165.00, method: 'tarjeta',       date: format(subDays(new Date(),14), 'yyyy-MM-dd'), time: '15:30', cashierId: 'u002', cashierName: 'Lucia Torres', notes: 'Almuerzo familiar grande', status: 'paid', guests: 6 },
]

// ── Creación del contexto ─────────────────────────────────────────────────────
const CashContext = createContext(null)

// ── Provider principal ────────────────────────────────────────────────────────
export function CashProvider({ children }) {
  const [payments,   setPayments]   = useState([])
  const [shift,      setShift]      = useState(null)   // turno activo
  const [isLoading,  setLoading]    = useState(true)

  const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:4003/api'
    : '/caja/api'

  const refreshPayments = useCallback(() => {
    fetch(`${API_URL}/payments`)
      .then(res => res.json())
      .then(data => {
        let incoming = []
        if (data && Array.isArray(data.value)) {
          incoming = data.value
        } else if (Array.isArray(data)) {
          incoming = data
        }
        setPayments(prev => {
          const map = new Map()
          // Conservar los locales primero
          prev.forEach(p => map.set(p.id, p))
          // Sobrescribir con los del backend
          incoming.forEach(p => map.set(p.id, p))
          // Ordenar (los más recientes arriba)
          return Array.from(map.values()).sort((a, b) => b.id.localeCompare(a.id))
        })
      })
      .catch(err => {
        console.error("Error loading payments", err)
        setPayments(SAMPLE_PAYMENTS)
      })
      .finally(() => {
        setLoading(false)
      })

    fetch(`${API_URL}/shift`)
      .then(res => res.json())
      .then(data => {
        // El backend responde { active, shift }; tambien se acepta el turno plano
        if (data?.active && data.shift) {
          setShift(data.shift)
        } else if (data?.status === 'open') {
          setShift(data)
        } else {
          // Mitigación ALB: Si ya tenemos un turno activo, no lo borres porque el backend respondió null
          setShift(prev => prev ? prev : null)
        }
      })
      .catch(() => {
        setShift(null)
      })
  }, [])

  // Cargar desde la API al montar
  useEffect(() => {
    refreshPayments()
  }, [refreshPayments])

  /** Genera ID único de pago */
  const generateId = () => `P${Date.now().toString().slice(-6)}`

  /**
   * openShift — Abre un nuevo turno de caja.
   * @param {Object} cashier - Datos del cajero { id, name }
   * @param {number} initialCash - Monto de apertura en efectivo
   */
  const openShift = useCallback((cashier, initialCash = 0) => {
    const newShift = {
      id: `T${Date.now().toString().slice(-6)}`,
      cashierId:   cashier.id,
      cashierName: cashier.name,
      openedAt:    new Date().toISOString(),
      closedAt:    null,
      initialCash,
      status:      'open',
    }
    setShift(newShift)

    fetch(`${API_URL}/shift/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newShift)
    })
      .then(() => refreshPayments())
      .catch(err => console.error("Error opening shift", err))

    return newShift
  }, [refreshPayments])

  /**
   * closeShift — Cierra el turno actual y genera resumen.
   * @returns {Object} Resumen del turno
   */
  const closeShift = useCallback(() => {
    if (!shift) return null
    const today = format(new Date(), 'yyyy-MM-dd')
    const shiftPayments = payments.filter(
      p => p.cashierId === shift.cashierId && p.date === today && p.status !== 'anulado'
    )
    const summary = {
      ...shift,
      closedAt:    new Date().toISOString(),
      status:      'closed',
      totalAmount: shiftPayments.reduce((s, p) => s + p.amount, 0),
      totalTx:     shiftPayments.length,
      byMethod:    PAYMENT_METHODS.reduce((acc, m) => {
        acc[m.id] = shiftPayments.filter(p => p.method === m.id).reduce((s, p) => s + p.amount, 0)
        return acc
      }, {}),
    }
    setShift(null)

    fetch(`${API_URL}/shift/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary)
    })
      .then(() => refreshPayments())
      .catch(err => console.error("Error closing shift", err))

    return summary
  }, [shift, payments, refreshPayments])

  /**
   * addPayment — Registra un nuevo cobro.
   * @param {Object} data - Datos del pago
   * @returns {Object} El pago creado
   */
  const addPayment = useCallback((data) => {
    const newPayment = {
      ...data,
      id:     generateId(),
      date:   format(new Date(), 'yyyy-MM-dd'),
      time:   format(new Date(), 'HH:mm'),
      status: 'paid',
    }
    setPayments(prev => [newPayment, ...prev])

    fetch(`${API_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPayment)
    })
      .then(() => refreshPayments())
      .catch(err => console.error("Error adding payment", err))

    return newPayment
  }, [refreshPayments])

  /**
   * voidPayment — Anula una cuenta/boleta (acción exclusiva del Líder).
   * El pago queda marcado como 'anulado' y se excluye de los totales.
   */
  const voidPayment = useCallback((id, reason = '', voidedBy = '') => {
    const voidData = { status: 'anulado', voidReason: reason, voidedBy, voidedAt: new Date().toISOString() }
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...voidData } : p))

    fetch(`${API_URL}/payments/${id}/void`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(voidData)
    })
      .then(() => refreshPayments())
      .catch(err => console.error("Error voiding payment", err))
  }, [refreshPayments])

  // Pagos de hoy (los anulados se muestran pero no suman)
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayPayments = payments.filter(p => p.date === todayStr)
  const validTodayPayments = todayPayments.filter(p => p.status !== 'anulado')
  const todayTotal    = validTodayPayments.reduce((s, p) => s + p.amount, 0)

  // Totales por método (hoy)
  const todayByMethod = PAYMENT_METHODS.reduce((acc, m) => {
    acc[m.id] = validTodayPayments.filter(p => p.method === m.id).reduce((s, p) => s + p.amount, 0)
    return acc
  }, {})

  const value = {
    payments,
    todayPayments,
    todayTotal,
    todayByMethod,
    shift,
    isLoading,
    openShift,
    closeShift,
    addPayment,
    voidPayment,
  }

  return <CashContext.Provider value={value}>{children}</CashContext.Provider>
}

// ── Hook personalizado ────────────────────────────────────────────────────────
export function useCash() {
  const ctx = useContext(CashContext)
  if (!ctx) throw new Error('useCash debe usarse dentro de <CashProvider>')
  return ctx
}

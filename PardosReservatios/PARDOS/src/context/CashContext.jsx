/**
 * src/context/CashContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de Caja — módulo exclusivo del Cajero.
 * Gestiona:
 *   - Cobros de reservas (genera tickets de venta)
 *   - Estado del turno de caja (apertura / cierre)
 *   - Resumen del turno: total cobrado, n° transacciones
 *   - Historial de pagos por turno y por fecha
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { SAMPLE_PAYMENTS } from '../data/seeds/paymentsSeed'
import { PAYMENT_METHODS } from '../domain/cash/paymentMethods'
import { summarizeShift, calculateTotalByMethod } from '../domain/cash/cashCalculations'
import { readJSON, writeJSON, remove } from '../data/storage/localStorage'
import toast from 'react-hot-toast'

export { PAYMENT_METHODS }

const CashContext = createContext(null)

export function CashProvider({ children }) {
  const [payments,   setPayments]   = useState(() => {
    return readJSON('pardos_payments', null) || SAMPLE_PAYMENTS
  })
  const [shift,      setShift]      = useState(() => {
    return readJSON('pardos_shift', null)
  })
  const [isLoading]                 = useState(false)

  useEffect(() => {
    if (!isLoading) writeJSON('pardos_payments', payments)
  }, [payments, isLoading])

  useEffect(() => {
    if (!isLoading) {
      if (shift) writeJSON('pardos_shift', shift)
      else remove('pardos_shift')
    }
  }, [shift, isLoading])

  const generateId = () => `P${Date.now().toString().slice(-6)}`

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
    toast.success('Turno de caja abierto')
    return newShift
  }, [])

  const closeShift = useCallback(() => {
    if (!shift) return null
    const summary = summarizeShift(shift, payments)
    setShift(null)
    toast.success('Turno cerrado correctamente')
    return summary
  }, [shift, payments])

  const addPayment = useCallback((data) => {
    const newPayment = {
      ...data,
      id:     generateId(),
      date:   format(new Date(), 'yyyy-MM-dd'),
      time:   format(new Date(), 'HH:mm'),
      status: 'paid',
      type:   'full',
    }
    setPayments(prev => [newPayment, ...prev])
    toast.success('Pago registrado correctamente')
    return newPayment
  }, [])

  /**
   * Registra un pago parcial de señal de separación de mesa.
   * Queda en el historial con type: 'deposit' para distinguirlo del cobro final.
   */
  const addDeposit = useCallback((data) => {
    const newDeposit = {
      ...data,
      id:     generateId(),
      date:   format(new Date(), 'yyyy-MM-dd'),
      time:   format(new Date(), 'HH:mm'),
      status: 'paid',
      type:   'deposit',
    }
    setPayments(prev => [newDeposit, ...prev])
    return newDeposit
  }, [])

  // Pagos de hoy
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayPayments = payments.filter(p => p.date === todayStr)
  const todayTotal    = todayPayments.reduce((s, p) => s + p.amount, 0)
  const todayByMethod = calculateTotalByMethod(todayPayments)

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
    addDeposit,
  }

  return <CashContext.Provider value={value}>{children}</CashContext.Provider>
}

export function useCash() {
  const ctx = useContext(CashContext)
  if (!ctx) throw new Error('useCash debe usarse dentro de <CashProvider>')
  return ctx
}

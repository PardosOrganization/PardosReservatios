/**
 * src/context/ReservationContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de reservas.
 * Centraliza el estado de todas las reservas (actuales e históricas),
 * las mesas disponibles y los clientes registrados.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS } from '../domain/reservations/reservationStatus'
import { generateReservationId, isHistorical, isToday } from '../domain/reservations/reservationRules'
import { SAMPLE_RESERVATIONS, INITIAL_TABLES } from '../data/seeds/reservationsSeed'
import { fetchRequested, patchReservation } from '../data/api/reservationsApi'
import { readJSON, writeJSON } from '../data/storage/localStorage'
import toast from 'react-hot-toast'

export { RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS }

const ReservationContext = createContext(null)

export function ReservationProvider({ children }) {
  const [reservations, setReservations] = useState(() => {
    return readJSON('pardos_reservations', null) || SAMPLE_RESERVATIONS
  })
  const [tables] = useState(INITIAL_TABLES)
  const [isLoading] = useState(false)
  const seenApiIds = useRef(new Set())

  // Persistir reservas en localStorage cada vez que cambian
  useEffect(() => {
    if (!isLoading) {
      writeJSON('pardos_reservations', reservations)
    }
  }, [reservations, isLoading])

  useEffect(() => {
    const pollApi = async () => {
      try {
        const apiRequested = await fetchRequested()
        if (apiRequested.length === 0) return

        setReservations(prev => {
          const existingIds = new Set(prev.map(r => r.id))
          const newOnes = apiRequested.filter(r => {
            if (existingIds.has(r.id)) return false
            if (seenApiIds.current.has(r.id)) return false
            return true
          })
          if (newOnes.length === 0) return prev
          newOnes.forEach(r => seenApiIds.current.add(r.id))
          return [...newOnes, ...prev]
        })
      } catch {
        // Silent block
      }
    }

    pollApi()
    const interval = setInterval(pollApi, 5000)
    return () => clearInterval(interval)
  }, [])

  const addReservation = useCallback((data) => {
    const newReservation = {
      ...data,
      id: generateReservationId(),
      status: RESERVATION_STATUS.PENDING,
      createdAt: new Date().toISOString(),
    }
    setReservations(prev => [newReservation, ...prev])
    toast.success('Reserva creada exitosamente')
    return newReservation
  }, [])

  const updateReservation = useCallback((id, updates) => {
    setReservations(prev =>
      prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)
    )
    toast.success('Reserva actualizada')
  }, [])

  const cancelReservation = useCallback((id, reason = '') => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.CANCELLED, cancelReason: reason, updatedAt: new Date().toISOString() }
          : r
      )
    )
    toast.success('Reserva cancelada')
  }, [])

  const completeReservation = useCallback((id) => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.COMPLETED, updatedAt: new Date().toISOString() }
          : r
      )
    )
    toast.success('Reserva completada')
  }, [])

  const seatReservation = useCallback((id) => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.SEATED, seatedAt: new Date().toISOString() }
          : r
      )
    )
    toast.success('Cliente en mesa')
  }, [])

  const requestReservation = useCallback((data) => {
    const newReservation = {
      ...data,
      id:        generateReservationId(),
      status:    RESERVATION_STATUS.REQUESTED,
      createdAt: new Date().toISOString(),
      source:    'public',
    }
    setReservations(prev => [newReservation, ...prev])
    toast.success('Solicitud enviada')
    return newReservation
  }, [])

  const approveReservation = useCallback((id, tableId, approvedBy) => {
    const approvedAt = new Date().toISOString()
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.PENDING, tableId, approvedBy, approvedAt }
          : r
      )
    )
    patchReservation(id, { status: 'pending', tableId, approvedBy, approvedAt })
    toast.success('Solicitud aprobada')
  }, [])

  const rejectReservation = useCallback((id, reason = '') => {
    const updatedAt = new Date().toISOString()
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.REJECTED, rejectReason: reason, updatedAt }
          : r
      )
    )
    patchReservation(id, { status: 'rejected', rejectReason: reason, updatedAt })
    toast.success('Solicitud rechazada')
  }, [])

  const deleteReservationFromDB = useCallback((id) => {
    setReservations(prev => prev.filter(r => r.id !== id))
    // En API se usaría un DELETE /api/reservations/:id
    toast.success('Reserva eliminada')
  }, [])

  /**
   * Registra el pago de la señal de separación de mesa.
   * Regla de negocio: el cliente debe pagar ≥ 50% para que la reserva
   * sea visible para el mozo y se puedan enviar pedidos a cocina.
   */
  const registerDeposit = useCallback((id, { amount, method, cashierName, cashierId }) => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? {
              ...r,
              depositPaid:    true,
              depositAmount:  amount,
              depositMethod:  method,
              depositCashier: cashierName,
              depositCashierId: cashierId,
              depositAt:      new Date().toISOString(),
              updatedAt:      new Date().toISOString(),
            }
          : r
      )
    )
    toast.success(`Señal de S/ ${amount.toFixed(2)} registrada`)
  }, [])

  // Solo reservas con señal pagada (o ya en mesa) — las ve el mozo
  const todayReservations = reservations.filter(r =>
    isToday(r) && (r.depositPaid === true || r.status === RESERVATION_STATUS.SEATED)
  )
  const pendingRequests = reservations.filter(r => r.status === RESERVATION_STATUS.REQUESTED)
  const historicalReservations = reservations.filter(isHistorical)

  // Devuelve reservas de una fecha específica (para Caja, que puede cobrar cualquier día)
  const getReservationsByDate = useCallback((dateStr) => {
    return reservations.filter(r =>
      r.date === dateStr &&
      r.status !== RESERVATION_STATUS.CANCELLED &&
      r.status !== RESERVATION_STATUS.REJECTED &&
      r.status !== RESERVATION_STATUS.COMPLETED
    )
  }, [reservations])

  const value = {
    reservations,
    todayReservations,
    historicalReservations,
    pendingRequests,
    tables,
    isLoading,
    addReservation,
    updateReservation,
    cancelReservation,
    completeReservation,
    seatReservation,
    requestReservation,
    approveReservation,
    rejectReservation,
    deleteReservationFromDB,
    getReservationsByDate,
    registerDeposit,
  }

  return <ReservationContext.Provider value={value}>{children}</ReservationContext.Provider>
}

export function useReservations() {
  const ctx = useContext(ReservationContext)
  if (!ctx) throw new Error('useReservations debe usarse dentro de <ReservationProvider>')
  return ctx
}

/**
 * src/context/ReservationContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de reservas.
 * Centraliza el estado de todas las reservas (actuales e históricas),
 * las mesas disponibles y los clientes registrados.
 *
 * Funciones principales:
 *   - addReservation     → Crear nueva reserva
 *   - updateReservation  → Actualizar estado o datos de una reserva
 *   - cancelReservation  → Cancelar una reserva (pasa a historial)
 *   - completeReservation → Marcar como completada
 *
 * Los datos se persisten en localStorage (simula una base de datos local).
 * En producción, reemplazar las funciones con llamadas a una API REST.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { format, subDays } from 'date-fns'

// ── Estados posibles de una reserva ──────────────────────────────────────────
export const RESERVATION_STATUS = {
  REQUESTED: 'requested',  // Solicitada por cliente externo — en espera de aprobación
  PENDING:   'pending',    // Aprobada, esperando al cliente
  SEATED:    'seated',     // Cliente ya llegó y está sentado
  COMPLETED: 'completed',  // Reserva completada (histórico)
  CANCELLED: 'cancelled',  // Cancelada (histórico)
  REJECTED:  'rejected',   // Rechazada por el personal
  NO_SHOW:   'no_show',    // Cliente no se presentó (histórico)
}

export const STATUS_LABELS = {
  requested: 'Solicitud',
  pending:   'Pendiente',
  seated:    'En Mesa',
  completed: 'Completada',
  cancelled: 'Cancelada',
  rejected:  'Rechazada',
  no_show:   'No se presentó',
}

export const STATUS_COLORS = {
  requested: 'purple',
  pending:   'warning',
  seated:    'info',
  completed: 'success',
  cancelled: 'error',
  rejected:  'error',
  no_show:   'neutral',
}

// ── Mesas del restaurante ─────────────────────────────────────────────────────
const INITIAL_TABLES = Array.from({ length: 20 }, (_, i) => ({
  id: `T${String(i + 1).padStart(2, '0')}`,
  number: i + 1,
  capacity: [2, 2, 4, 4, 4, 6, 6, 2, 4, 4, 6, 2, 4, 8, 4, 6, 2, 4, 4, 6][i],
  zone: i < 8 ? 'Salón Principal' : i < 14 ? 'Terraza' : 'VIP',
  isAvailable: true,
}))

// ── Helper: generar fecha relativa ────────────────────────────────────────────
const d = (daysAgo) => format(subDays(new Date(), daysAgo), 'yyyy-MM-dd')
const today = format(new Date(), 'yyyy-MM-dd')

// ── Datos de muestra abundantes ───────────────────────────────────────────────
const SAMPLE_RESERVATIONS = [
  // ── HOY — activas ──────────────────────────────────
  {
    id: 'R001', clientId: 'C001',
    clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
    date: today, time: '13:00', guests: 4, tableId: 'T03',
    status: RESERVATION_STATUS.PENDING,
    notes: 'Cumpleaños, pedir torta de chocolate', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: 'Cumpleaños',
  },
  {
    id: 'R002', clientId: 'C002',
    clientName: 'Roberto Silva', clientPhone: '912345678', clientEmail: 'roberto@email.com',
    date: today, time: '14:30', guests: 2, tableId: 'T01',
    status: RESERVATION_STATUS.SEATED,
    notes: '', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R003', clientId: 'C004',
    clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
    date: today, time: '19:00', guests: 6, tableId: 'T06',
    status: RESERVATION_STATUS.PENDING,
    notes: 'Cena de aniversario', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: 'Aniversario',
  },
  {
    id: 'R004', clientId: 'C005',
    clientName: 'Carlos Quispe', clientPhone: '956781234', clientEmail: 'carlos_q@email.com',
    date: today, time: '20:30', guests: 8, tableId: 'T14',
    status: RESERVATION_STATUS.PENDING,
    notes: 'Reunión de empresa', createdAt: new Date().toISOString(),
    createdBy: 'u002', occasion: 'Reunión',
  },
  {
    id: 'R005', clientId: 'C006',
    clientName: 'Lucia Mendoza', clientPhone: '999888777', clientEmail: 'lucia_m@email.com',
    date: today, time: '21:00', guests: 4, tableId: 'T15',
    status: RESERVATION_STATUS.PENDING,
    notes: 'Mesa VIP solicitada', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: '',
  },

  // ── AYER ──────────────────────────────────────────
  {
    id: 'R006', clientId: 'C003',
    clientName: 'Ana López', clientPhone: '998877665', clientEmail: 'ana@email.com',
    date: d(1), time: '13:30', guests: 3, tableId: 'T05',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 1).toISOString(),
    createdBy: 'u004', occasion: 'Almuerzo familiar',
  },
  {
    id: 'R007', clientId: 'C007',
    clientName: 'Jorge Castillo', clientPhone: '988112233', clientEmail: 'jorge_c@email.com',
    date: d(1), time: '14:00', guests: 2, tableId: 'T02',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 1).toISOString(),
    createdBy: 'u002', occasion: '',
  },
  {
    id: 'R008', clientId: 'C008',
    clientName: 'Isabel Torres', clientPhone: '912233445', clientEmail: 'isabel@email.com',
    date: d(1), time: '20:00', guests: 5, tableId: 'T11',
    status: RESERVATION_STATUS.COMPLETED,
    notes: 'Solicitar mesa tranquila', createdAt: subDays(new Date(), 1).toISOString(),
    createdBy: 'u004', occasion: 'Cena',
  },
  {
    id: 'R009', clientId: 'C009',
    clientName: 'Pedro Vásquez', clientPhone: '977665544', clientEmail: 'pedro@email.com',
    date: d(1), time: '19:30', guests: 4, tableId: 'T10',
    status: RESERVATION_STATUS.CANCELLED,
    cancelReason: 'Cliente llamó para cancelar',
    notes: '', createdAt: subDays(new Date(), 1).toISOString(),
    createdBy: 'u002', occasion: '',
  },

  // ── HACE 2 DÍAS ───────────────────────────────────
  {
    id: 'R010', clientId: 'C001',
    clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
    date: d(2), time: '13:00', guests: 4, tableId: 'T04',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 2).toISOString(),
    createdBy: 'u004', occasion: 'Almuerzo familiar',
  },
  {
    id: 'R011', clientId: 'C010',
    clientName: 'Sandra Reyes', clientPhone: '944332211', clientEmail: 'sandra@email.com',
    date: d(2), time: '20:00', guests: 2, tableId: 'T01',
    status: RESERVATION_STATUS.NO_SHOW,
    notes: '', createdAt: subDays(new Date(), 2).toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R012', clientId: 'C004',
    clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
    date: d(2), time: '14:30', guests: 3, tableId: 'T07',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 2).toISOString(),
    createdBy: 'u004', occasion: '',
  },

  // ── HACE 3 DÍAS ───────────────────────────────────
  {
    id: 'R013', clientId: 'C003',
    clientName: 'Ana López', clientPhone: '998877665', clientEmail: 'ana@email.com',
    date: d(3), time: '12:30', guests: 5, tableId: 'T06',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 3).toISOString(),
    createdBy: 'u002', occasion: 'Reunión',
  },
  {
    id: 'R014', clientId: 'C011',
    clientName: 'Enrique Huamán', clientPhone: '955443322', clientEmail: 'enrique@email.com',
    date: d(3), time: '19:00', guests: 6, tableId: 'T12',
    status: RESERVATION_STATUS.COMPLETED,
    notes: 'Corporativo', createdAt: subDays(new Date(), 3).toISOString(),
    createdBy: 'u002', occasion: 'Reunión',
  },
  {
    id: 'R015', clientId: 'C002',
    clientName: 'Roberto Silva', clientPhone: '912345678', clientEmail: 'roberto@email.com',
    date: d(3), time: '20:30', guests: 2, tableId: 'T08',
    status: RESERVATION_STATUS.CANCELLED,
    cancelReason: 'Cambio de planes',
    notes: '', createdAt: subDays(new Date(), 3).toISOString(),
    createdBy: 'u004', occasion: '',
  },

  // ── HACE 5 DÍAS ───────────────────────────────────
  {
    id: 'R016', clientId: 'C005',
    clientName: 'Carlos Quispe', clientPhone: '956781234', clientEmail: 'carlos_q@email.com',
    date: d(5), time: '13:00', guests: 8, tableId: 'T14',
    status: RESERVATION_STATUS.COMPLETED,
    notes: 'Aniversario empresa', createdAt: subDays(new Date(), 5).toISOString(),
    createdBy: 'u002', occasion: 'Aniversario',
  },
  {
    id: 'R017', clientId: 'C007',
    clientName: 'Jorge Castillo', clientPhone: '988112233', clientEmail: 'jorge_c@email.com',
    date: d(5), time: '20:00', guests: 4, tableId: 'T10',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 5).toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R018', clientId: 'C012',
    clientName: 'Valeria Cruz', clientPhone: '966554433', clientEmail: 'valeria@email.com',
    date: d(5), time: '14:00', guests: 3, tableId: 'T05',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 5).toISOString(),
    createdBy: 'u004', occasion: 'Cumpleaños',
  },

  // ── HACE 7 DÍAS ───────────────────────────────────
  {
    id: 'R019', clientId: 'C001',
    clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
    date: d(7), time: '13:00', guests: 4, tableId: 'T03',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 7).toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R020', clientId: 'C008',
    clientName: 'Isabel Torres', clientPhone: '912233445', clientEmail: 'isabel@email.com',
    date: d(7), time: '20:30', guests: 6, tableId: 'T11',
    status: RESERVATION_STATUS.COMPLETED,
    notes: 'Cena especial', createdAt: subDays(new Date(), 7).toISOString(),
    createdBy: 'u004', occasion: 'Cena',
  },

  // ── HACE 10 DÍAS ──────────────────────────────────
  {
    id: 'R021', clientId: 'C003',
    clientName: 'Ana López', clientPhone: '998877665', clientEmail: 'ana@email.com',
    date: d(10), time: '14:00', guests: 2, tableId: 'T09',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 10).toISOString(),
    createdBy: 'u002', occasion: '',
  },
  {
    id: 'R022', clientId: 'C006',
    clientName: 'Lucia Mendoza', clientPhone: '999888777', clientEmail: 'lucia_m@email.com',
    date: d(10), time: '19:30', guests: 4, tableId: 'T15',
    status: RESERVATION_STATUS.COMPLETED,
    notes: 'Mesa VIP', createdAt: subDays(new Date(), 10).toISOString(),
    createdBy: 'u004', occasion: 'Aniversario',
  },
  {
    id: 'R023', clientId: 'C011',
    clientName: 'Enrique Huamán', clientPhone: '955443322', clientEmail: 'enrique@email.com',
    date: d(10), time: '13:00', guests: 5, tableId: 'T06',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 10).toISOString(),
    createdBy: 'u002', occasion: 'Reunión',
  },

  // ── HACE 14 DÍAS ──────────────────────────────────
  {
    id: 'R024', clientId: 'C004',
    clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
    date: d(14), time: '20:00', guests: 4, tableId: 'T10',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 14).toISOString(),
    createdBy: 'u004', occasion: 'Cena',
  },
  {
    id: 'R025', clientId: 'C012',
    clientName: 'Valeria Cruz', clientPhone: '966554433', clientEmail: 'valeria@email.com',
    date: d(14), time: '14:30', guests: 6, tableId: 'T12',
    status: RESERVATION_STATUS.COMPLETED,
    notes: '', createdAt: subDays(new Date(), 14).toISOString(),
    createdBy: 'u002', occasion: 'Almuerzo familiar',
  },
]

// ── Creación del contexto ─────────────────────────────────────────────────────
const ReservationContext = createContext(null)

// ── Provider principal ────────────────────────────────────────────────────────
export function ReservationProvider({ children }) {
  const [reservations, setReservations] = useState([])
  const [tables, setTables] = useState(INITIAL_TABLES)
  const [isLoading, setIsLoading] = useState(true)

  // Cargar datos desde localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pardos_reservations')
      if (saved) {
        setReservations(JSON.parse(saved))
      } else {
        setReservations(SAMPLE_RESERVATIONS)
      }
    } catch {
      setReservations(SAMPLE_RESERVATIONS)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Persistir reservas en localStorage cada vez que cambian
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('pardos_reservations', JSON.stringify(reservations))
    }
  }, [reservations, isLoading])

  /** Genera un ID único para una reserva */
  const generateId = () => `R${Date.now().toString().slice(-6)}`

  /** addReservation — Agrega una nueva reserva al sistema. */
  const addReservation = useCallback((data) => {
    const newReservation = {
      ...data,
      id: generateId(),
      status: RESERVATION_STATUS.PENDING,
      createdAt: new Date().toISOString(),
    }
    setReservations(prev => [newReservation, ...prev])
    return newReservation
  }, [])

  /** updateReservation — Actualiza una reserva existente por su id. */
  const updateReservation = useCallback((id, updates) => {
    setReservations(prev =>
      prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)
    )
  }, [])

  /** cancelReservation — Cambia el estado a 'cancelled'. */
  const cancelReservation = useCallback((id, reason = '') => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.CANCELLED, cancelReason: reason, updatedAt: new Date().toISOString() }
          : r
      )
    )
  }, [])

  /** completeReservation — Marca una reserva como completada. */
  const completeReservation = useCallback((id) => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.COMPLETED, updatedAt: new Date().toISOString() }
          : r
      )
    )
  }, [])

  /** seatReservation — Marca al cliente como sentado. */
  const seatReservation = useCallback((id) => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.SEATED, seatedAt: new Date().toISOString() }
          : r
      )
    )
  }, [])

  /**
   * requestReservation — Crea una reserva en estado REQUESTED (pública).
   * No requiere autenticación. Queda pendiente de aprobación.
   */
  const requestReservation = useCallback((data) => {
    const newReservation = {
      ...data,
      id:        `R${Date.now().toString().slice(-6)}`,
      status:    RESERVATION_STATUS.REQUESTED,
      createdAt: new Date().toISOString(),
      source:    'public', // indica que vino del formulario público
    }
    setReservations(prev => [newReservation, ...prev])
    return newReservation
  }, [])

  /**
   * approveReservation — Aprueba una solicitud (REQUESTED → PENDING).
   * @param {string} id
   * @param {string} tableId - Mesa asignada
   * @param {string} approvedBy - Nombre del operador
   */
  const approveReservation = useCallback((id, tableId, approvedBy) => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.PENDING, tableId, approvedBy, approvedAt: new Date().toISOString() }
          : r
      )
    )
  }, [])

  /**
   * rejectReservation — Rechaza una solicitud (REQUESTED → REJECTED).
   * @param {string} id
   * @param {string} reason
   */
  const rejectReservation = useCallback((id, reason = '') => {
    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, status: RESERVATION_STATUS.REJECTED, rejectReason: reason, updatedAt: new Date().toISOString() }
          : r
      )
    )
  }, [])

  // Reservas de hoy (activas)
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayReservations = reservations.filter(
    r => r.date === todayStr &&
    r.status !== RESERVATION_STATUS.CANCELLED &&
    r.status !== RESERVATION_STATUS.REJECTED
  )

  // Solicitudes pendientes de aprobación
  const pendingRequests = reservations.filter(r => r.status === RESERVATION_STATUS.REQUESTED)

  // Historial (completadas, canceladas, no-show, rechazadas)
  const historicalReservations = reservations.filter(
    r => [RESERVATION_STATUS.COMPLETED, RESERVATION_STATUS.CANCELLED,
          RESERVATION_STATUS.NO_SHOW, RESERVATION_STATUS.REJECTED].includes(r.status)
  )

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
  }

  return <ReservationContext.Provider value={value}>{children}</ReservationContext.Provider>
}

// ── Hook personalizado ────────────────────────────────────────────────────────
export function useReservations() {
  const ctx = useContext(ReservationContext)
  if (!ctx) throw new Error('useReservations debe usarse dentro de <ReservationProvider>')
  return ctx
}

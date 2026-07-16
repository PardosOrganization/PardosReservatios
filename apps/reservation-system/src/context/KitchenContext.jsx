/**
 * src/context/KitchenContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de Cocina — módulo exclusivo del Jefe de Cocina.
 * Gestiona los tickets/pedidos que llegan a la cocina según las reservas
 * activas, permite cambiar su estado: pendiente → en preparación → listo.
 *
 * Flujo de un ticket:
 *   1. Se genera automáticamente al sentar a un cliente (status=seated)
 *   2. El jefe de cocina lo ve como "Pendiente"
 *   3. Lo pasa a "En preparación"
 *   4. Luego lo marca como "Listo para servir"
 *
 * En producción: integrar con WebSockets para tiempo real.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'

// ── Estados del ticket de cocina ──────────────────────────────────────────────
export const TICKET_STATUS = {
  PENDING:     'pending',      // Recibido, aún no se empieza a preparar
  PREPARING:   'preparing',    // En preparación
  READY:       'ready',        // Listo para servir
  SERVED:      'served',       // Ya fue llevado a la mesa
}

export const TICKET_STATUS_LABELS = {
  pending:   'Pendiente',
  preparing: 'En Preparación',
  ready:     'Listo ✓',
  served:    'Servido',
}

export const TICKET_STATUS_COLORS = {
  pending:   '#e67e22',
  preparing: '#2980b9',
  ready:     '#27ae60',
  served:    '#95a5a6',
}

// ── Carta oficial de Pardos con tiempo estimado de preparación ────────────────
import { MENU_ITEMS as CARTA_PARDOS } from '../domain/kitchen/menu'

const PREP_TIME_BY_CATEGORY = {
  'Aperitivos': 10,
  'Especiales al Plato': 20,
  'Especial del Mes': 15,
  'Ensaladas para Compartir': 8,
  'Ensaladas de Fondo': 10,
  'Pardos Brasa': 20,
  'Pardos Parrillero': 25,
  'Para los Carnívoros': 25,
  'Menú Kids': 15,
  'Parrillas': 35,
  'Pardos Brasa Familiar': 25,
  'Guarniciones': 8,
  'Adiciones': 5,
  'Postres': 5,
  'Bebidas': 3,
  'Cócteles': 5,
  'Cócteles Premium': 6,
  'Cervezas y Vinos': 2,
  'Infusiones': 3,
}

export const MENU_ITEMS = CARTA_PARDOS.map(item => ({
  ...item,
  time: PREP_TIME_BY_CATEGORY[item.category] ?? 10,
}))

// ── Tickets de ejemplo ────────────────────────────────────────────────────────
const SAMPLE_TICKETS = [
  {
    id: 'TK001',
    tableId: 'T01',
    clientName: 'Roberto Silva',
    guests: 2,
    status: TICKET_STATUS.PREPARING,
    reservationId: null,
    items: [
      { menuId: 'M01', name: 'Pollo a la Brasa 1/4',  qty: 2, price: 28.00, notes: '', status: 'ready' },
      { menuId: 'M04', name: 'Papas fritas',           qty: 2, price:  9.00, notes: 'Extra crujiente', status: 'pending' },
      { menuId: 'M07', name: 'Chicha morada jarra',    qty: 1, price: 12.00, notes: '', status: 'ready' },
    ],
    priority: 'normal',
    notes: '',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: 'TK002',
    tableId: 'T06', // Matching screenshot
    clientName: 'Anghelo', // Matching screenshot
    guests: 2,
    status: TICKET_STATUS.PENDING,
    reservationId: 'R_MOCK_1', // Link for cash
    items: [
      { menuId: 'M10', name: 'Anticucho (1)', qty: 1, price: 9.90, notes: '', status: 'pending' },
      { menuId: 'M06', name: 'Lomo a la Parrilla (Grande)', qty: 1, price: 54.90, notes: '', status: 'pending' },
      { menuId: 'M11', name: 'Chorizos Cocktail (4)', qty: 1, price: 9.90, notes: '', status: 'pending' },
    ],
    priority: 'high',
    notes: 'Cliente de prueba',
    createdAt: new Date(Date.now() - 3 * 60000).toISOString(),
  },
]

// ── Creación del contexto ─────────────────────────────────────────────────────
const KitchenContext = createContext(null)

// ── Provider principal ────────────────────────────────────────────────────────
export function KitchenProvider({ children }) {
  const [tickets,  setTickets]  = useState([])
  const [isLoading, setLoading] = useState(true)

  const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:4004/api'
    : '/cocina/api'

  const refreshTickets = useCallback(() => {
    fetch(`${API_URL}/tickets`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.value)) {
          setTickets(data.value)
        } else if (Array.isArray(data)) {
          setTickets(data)
        }
      })
      .catch(err => {
        console.error("Error loading tickets", err)
        setTickets(SAMPLE_TICKETS)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  // Cargar desde la API al montar
  useEffect(() => {
    refreshTickets()
  }, [refreshTickets])

  const generateId = () => `TK${Date.now().toString().slice(-4)}`

  /**
   * addTicket — Crea un nuevo ticket de cocina.
   * Envía al backend y usa el ID que devuelve el servidor.
   * @param {Object} data - { tableId, clientName, guests, items, notes, priority }
   */
  const addTicket = useCallback((data) => {
    // Optimistic: add locally with temp ID
    const tempId = `TK${Date.now().toString().slice(-4)}`
    const optimistic = {
      ...data,
      id:        tempId,
      status:    TICKET_STATUS.PENDING,
      createdAt: new Date().toISOString(),
    }
    setTickets(prev => [optimistic, ...prev])

    // Send to backend and refresh to get the real server-generated ID
    fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(res => res.json())
      .then(serverTicket => {
        // Replace the optimistic ticket with the server one
        setTickets(prev => prev.map(t => t.id === tempId ? serverTicket : t))
      })
      .catch(err => console.warn("Backend sync failed for addTicket:", err))

    return optimistic
  }, [API_URL])

  /**
   * updateItemStatus — Avanza el estado de un ítem individual en un ticket.
   * Persiste con PATCH /tickets/:id (items array completo).
   */
  const updateItemStatus = useCallback((ticketId, menuId, newStatus) => {
    setTickets(prev =>
      prev.map(t => {
        if (t.id !== ticketId) return t
        const newItems = t.items.map(item =>
          item.menuId === menuId ? { ...item, status: newStatus } : item
        )
        const updated = { ...t, items: newItems, updatedAt: new Date().toISOString() }

        // Persist via PATCH /tickets/:id with updated items
        fetch(`${API_URL}/tickets/${ticketId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: newItems })
        }).catch(err => console.warn("Backend sync failed for updateItemStatus:", err))

        return updated
      })
    )
  }, [API_URL])

  /**
   * updateTicketStatus — Avanza el estado de un ticket.
   * Usa PATCH /tickets/:id/status (endpoint que existe en el backend).
   * @param {string} id
   * @param {string} newStatus - TICKET_STATUS value
   */
  const updateTicketStatus = useCallback((id, newStatus) => {
    const updatedAt = new Date().toISOString()
    setTickets(prev =>
      prev.map(t =>
        t.id === id ? { ...t, status: newStatus, updatedAt } : t
      )
    )

    fetch(`${API_URL}/tickets/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).catch(err => console.warn("Backend sync failed for updateTicketStatus:", err))
  }, [API_URL])

  /**
   * updateTicket — Actualiza items o notas de un ticket pendiente.
   * Usa PATCH /tickets/:id (endpoint genérico del backend).
   */
  const updateTicket = useCallback((id, updates) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))

    fetch(`${API_URL}/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(err => console.warn("Backend sync failed for updateTicket:", err))
  }, [API_URL])

  /**
   * deleteTicketByReservation — Elimina un ticket asociado a una reserva cancelada.
   * Usa PATCH para marcar como "served" (el backend no tiene DELETE).
   */
  const deleteTicketByReservation = useCallback((reservationId) => {
    setTickets(prev => {
      const toDelete = prev.filter(t => t.reservationId === reservationId)
      toDelete.forEach(t => {
        fetch(`${API_URL}/tickets/${t.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: TICKET_STATUS.SERVED })
        }).catch(err => console.warn("Backend sync failed for deleteTicket:", err))
      })
      return prev.filter(t => t.reservationId !== reservationId)
    })
  }, [API_URL])

  // Tickets activos (no servidos)
  const activeTickets = tickets.filter(t => t.status !== TICKET_STATUS.SERVED)
  const pendingCount  = tickets.filter(t => t.status === TICKET_STATUS.PENDING).length
  const preparingCount = tickets.filter(t => t.status === TICKET_STATUS.PREPARING).length
  const readyCount    = tickets.filter(t => t.status === TICKET_STATUS.READY).length

  const value = {
    tickets,
    activeTickets,
    isLoading,
    pendingCount,
    preparingCount,
    readyCount,
    addTicket,
    updateTicketStatus,
    updateTicket,
    updateItemStatus,
    deleteTicketByReservation,
    menuItems: MENU_ITEMS,
  }

  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>
}

// ── Hook personalizado ────────────────────────────────────────────────────────
export function useKitchen() {
  const ctx = useContext(KitchenContext)
  if (!ctx) throw new Error('useKitchen debe usarse dentro de <KitchenProvider>')
  return ctx
}

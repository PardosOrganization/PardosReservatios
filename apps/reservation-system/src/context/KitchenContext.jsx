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

// ── Platos/ítems de ejemplo del menú de Pardos ────────────────────────────────
export const MENU_ITEMS = [
  { id: 'M01', name: 'Pollo a la Brasa 1/4',    category: 'Principal',       time: 20, price: 28.00 },
  { id: 'M02', name: 'Pollo a la Brasa 1/2',    category: 'Principal',       time: 25, price: 48.00 },
  { id: 'M03', name: 'Pollo a la Brasa Entero', category: 'Principal',       time: 35, price: 88.00 },
  { id: 'M04', name: 'Papas fritas',             category: 'Acompañamiento',  time: 10, price:  9.00 },
  { id: 'M05', name: 'Ensalada fresca',          category: 'Acompañamiento',  time:  5, price:  8.00 },
  { id: 'M06', name: 'Cremas surtidas',          category: 'Acompañamiento',  time:  2, price:  4.00 },
  { id: 'M07', name: 'Chicha morada jarra',      category: 'Bebida',          time:  3, price: 12.00 },
  { id: 'M08', name: 'Gaseosa 1.5L',             category: 'Bebida',          time:  2, price:  9.00 },
  { id: 'M09', name: 'Agua mineral 625ml',       category: 'Bebida',          time:  1, price:  4.50 },
  { id: 'M10', name: 'Anticuchos (6 unid.)',     category: 'Entrada',         time: 15, price: 22.00 },
  { id: 'M11', name: 'Choclo con queso',         category: 'Entrada',         time:  8, price: 10.00 },
  { id: 'M12', name: 'Causa a la limeña',        category: 'Entrada',         time:  8, price: 14.00 },
  { id: 'M13', name: 'Torta de chocolate',       category: 'Postre',          time:  5, price: 18.00 },
  { id: 'M14', name: 'Helado 2 bolas',           category: 'Postre',          time:  3, price: 10.00 },
]

// ── Tickets de ejemplo ────────────────────────────────────────────────────────
const SAMPLE_TICKETS = [
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

// ── Creación del contexto ─────────────────────────────────────────────────────
const KitchenContext = createContext(null)

// ── Provider principal ────────────────────────────────────────────────────────
export function KitchenProvider({ children }) {
  const [tickets,  setTickets]  = useState([])
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pardos_kitchen')
      setTickets(saved ? JSON.parse(saved) : SAMPLE_TICKETS)
    } catch {
      setTickets(SAMPLE_TICKETS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoading) localStorage.setItem('pardos_kitchen', JSON.stringify(tickets))
  }, [tickets, isLoading])

  const generateId = () => `TK${Date.now().toString().slice(-4)}`

  /**
   * addTicket — Crea un nuevo ticket de cocina.
   * @param {Object} data - { tableId, clientName, guests, items, notes, priority }
   */
  const addTicket = useCallback((data) => {
    const ticket = {
      ...data,
      id:        generateId(),
      status:    TICKET_STATUS.PENDING,
      createdAt: new Date().toISOString(),
    }
    setTickets(prev => [ticket, ...prev])
    return ticket
  }, [])

  /**
   * updateTicketStatus — Avanza el estado de un ticket.
   * @param {string} id
   * @param {string} newStatus - TICKET_STATUS value
   */
  const updateTicketStatus = useCallback((id, newStatus) => {
    setTickets(prev =>
      prev.map(t =>
        t.id === id ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t
      )
    )
  }, [])

  /**
   * updateTicket — Actualiza items o notas de un ticket pendiente.
   */
  const updateTicket = useCallback((id, updates) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }, [])

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

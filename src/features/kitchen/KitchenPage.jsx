/**
 * src/features/kitchen/KitchenPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de Cocina — exclusivo para el rol de Jefe de Cocina (y Admin).
 * Muestra en tiempo real los tickets de pedidos organizados por estado:
 *   - Pendiente    → Ingresaron pero no se empezó a preparar
 *   - En Preparación → Se está cocinando
 *   - Listo        → Listo para que el mozo lo lleve a la mesa
 *
 * Funcionalidades:
 *   - Vista en "tablero Kanban" por estado
 *   - Indicador de prioridad (alta = cumpleaños, evento especial)
 *   - Temporizador desde que se creó el ticket
 *   - Crear nuevos tickets manualmente
 *   - Avanzar y retroceder estado de un ticket
 *
 * Acceso: Jefe de Cocina, Administrador
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react'
import { ChefHat, Plus, Clock, AlertTriangle, CheckCircle2, Flame } from 'lucide-react'
import {
  useKitchen,
  TICKET_STATUS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  MENU_ITEMS,
} from '../../context/KitchenContext'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input, Select, Textarea } from '../../components/ui/Input'
import toast from 'react-hot-toast'
import styles from './KitchenPage.module.css'

// ── Temporizador en tiempo real ───────────────────────────────────────────────
function ElapsedTimer({ createdAt }) {
  const [mins, setMins] = useState(
    () => Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  )
  useEffect(() => {
    const interval = setInterval(() => {
      setMins(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
    }, 30000)
    return () => clearInterval(interval)
  }, [createdAt])
  return (
    <span className={`${styles.timer} ${mins > 20 ? styles.timerAlert : ''}`}>
      <Clock size={12} /> {mins} min
    </span>
  )
}

// ── Estado siguiente / anterior ───────────────────────────────────────────────
const STATUS_FLOW = [TICKET_STATUS.PENDING, TICKET_STATUS.PREPARING, TICKET_STATUS.READY, TICKET_STATUS.SERVED]

const STATUS_ICON = {
  pending:   <Clock size={14} />,
  preparing: <Flame size={14} />,
  ready:     <CheckCircle2 size={14} />,
  served:    <CheckCircle2 size={14} />,
}

// ── Ticket card ───────────────────────────────────────────────────────────────
function TicketCard({ ticket, onAdvance, onBack }) {
  const currentIdx = STATUS_FLOW.indexOf(ticket.status)
  const nextStatus = STATUS_FLOW[currentIdx + 1]
  const prevStatus = STATUS_FLOW[currentIdx - 1]
  const color = TICKET_STATUS_COLORS[ticket.status]

  return (
    <article className={`${styles.ticket} ${ticket.priority === 'high' ? styles.ticketHigh : ''}`}
      style={{ borderTopColor: color }}>
      {ticket.priority === 'high' && (
        <div className={styles.priorityBadge}>
          <AlertTriangle size={11} /> Alta prioridad
        </div>
      )}
      <div className={styles.ticketHeader}>
        <div>
          <span className={styles.ticketTable}>Mesa {ticket.tableId}</span>
          <h3 className={styles.ticketClient}>{ticket.clientName}</h3>
        </div>
        <div className={styles.ticketMeta}>
          <ElapsedTimer createdAt={ticket.createdAt} />
          <span className={styles.ticketGuests}>👥 {ticket.guests}</span>
        </div>
      </div>

      {/* Items */}
      <ul className={styles.itemList}>
        {ticket.items.map((item, i) => (
          <li key={i} className={styles.item}>
            <span className={styles.itemQty}>{item.qty}×</span>
            <span className={styles.itemName}>{item.name}</span>
            {item.notes && <span className={styles.itemNote}>({item.notes})</span>}
          </li>
        ))}
      </ul>

      {/* Notas especiales */}
      {ticket.notes && (
        <p className={styles.ticketNote}>
          <AlertTriangle size={12} /> {ticket.notes}
        </p>
      )}

      {/* Acciones */}
      <div className={styles.ticketActions}>
        {prevStatus && prevStatus !== TICKET_STATUS.SERVED && (
          <Button variant="ghost" size="sm" onClick={() => onBack(ticket.id, prevStatus)}>
            ← Atrás
          </Button>
        )}
        {nextStatus && (
          <Button
            variant={nextStatus === TICKET_STATUS.READY ? 'success' : 'primary'}
            size="sm"
            icon={STATUS_ICON[nextStatus]}
            onClick={() => onAdvance(ticket.id, nextStatus)}
          >
            {TICKET_STATUS_LABELS[nextStatus]}
          </Button>
        )}
      </div>
    </article>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function KitchenPage() {
  const { activeTickets, tickets, pendingCount, preparingCount, readyCount,
          addTicket, updateTicketStatus, menuItems } = useKitchen()

  const [isOpen, setOpen] = useState(false)
  const [newTicket, setNewTicket] = useState({
    tableId: '', clientName: '', guests: 2,
    priority: 'normal', notes: '', items: [],
  })
  const [selectedItems, setSelected] = useState([])

  // Tickets por columna
  const pending   = activeTickets.filter(t => t.status === TICKET_STATUS.PENDING)
  const preparing = activeTickets.filter(t => t.status === TICKET_STATUS.PREPARING)
  const ready     = activeTickets.filter(t => t.status === TICKET_STATUS.READY)

  const handleAdvance = (id, newStatus) => {
    updateTicketStatus(id, newStatus)
    toast.success(`Ticket → ${TICKET_STATUS_LABELS[newStatus]}`)
  }

  const handleBack = (id, prevStatus) => {
    updateTicketStatus(id, prevStatus)
  }

  const toggleItem = (item) => {
    setSelected(prev => {
      const exists = prev.find(i => i.menuId === item.id)
      if (exists) return prev.filter(i => i.menuId !== item.id)
      return [...prev, { menuId: item.id, name: item.name, qty: 1, notes: '' }]
    })
  }

  const handleCreateTicket = () => {
    if (!newTicket.tableId || !newTicket.clientName) {
      toast.error('Mesa y cliente son requeridos')
      return
    }
    if (selectedItems.length === 0) {
      toast.error('Agrega al menos un ítem al pedido')
      return
    }
    addTicket({ ...newTicket, items: selectedItems })
    toast.success('Ticket de cocina creado')
    setOpen(false)
    setNewTicket({ tableId: '', clientName: '', guests: 2, priority: 'normal', notes: '', items: [] })
    setSelected([])
  }

  // Categorías únicas
  const categories = [...new Set(MENU_ITEMS.map(m => m.category))]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Panel de Cocina</h1>
          <p className={styles.subtitle}>Gestión de pedidos en tiempo real</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)} id="btn-nuevo-ticket">
          Nuevo Ticket
        </Button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <StatCard label="Pendientes"      value={pendingCount}   icon={<Clock size={20} />}         color="warning" />
        <StatCard label="En preparación"  value={preparingCount} icon={<Flame size={20} />}          color="info" />
        <StatCard label="Listos"          value={readyCount}     icon={<CheckCircle2 size={20} />}   color="success" />
        <StatCard label="Total del día"   value={tickets.length} icon={<ChefHat size={20} />}        color="primary" />
      </div>

      {/* Tablero Kanban */}
      <div className={styles.kanban}>
        {/* Pendientes */}
        <div className={styles.column}>
          <div className={styles.colHeader} style={{ borderBottomColor: TICKET_STATUS_COLORS.pending }}>
            <Clock size={16} style={{ color: TICKET_STATUS_COLORS.pending }} />
            <span>Pendiente</span>
            <span className={styles.colCount}>{pending.length}</span>
          </div>
          <div className={styles.colBody}>
            {pending.length === 0 ? (
              <div className={styles.colEmpty}>Sin pedidos pendientes 🎉</div>
            ) : (
              pending.map(t => (
                <TicketCard key={t.id} ticket={t}
                  onAdvance={handleAdvance} onBack={handleBack} />
              ))
            )}
          </div>
        </div>

        {/* En preparación */}
        <div className={styles.column}>
          <div className={styles.colHeader} style={{ borderBottomColor: TICKET_STATUS_COLORS.preparing }}>
            <Flame size={16} style={{ color: TICKET_STATUS_COLORS.preparing }} />
            <span>En Preparación</span>
            <span className={styles.colCount}>{preparing.length}</span>
          </div>
          <div className={styles.colBody}>
            {preparing.length === 0 ? (
              <div className={styles.colEmpty}>Nada en preparación</div>
            ) : (
              preparing.map(t => (
                <TicketCard key={t.id} ticket={t}
                  onAdvance={handleAdvance} onBack={handleBack} />
              ))
            )}
          </div>
        </div>

        {/* Listos */}
        <div className={styles.column}>
          <div className={styles.colHeader} style={{ borderBottomColor: TICKET_STATUS_COLORS.ready }}>
            <CheckCircle2 size={16} style={{ color: TICKET_STATUS_COLORS.ready }} />
            <span>Listo para servir</span>
            <span className={styles.colCount}>{ready.length}</span>
          </div>
          <div className={styles.colBody}>
            {ready.length === 0 ? (
              <div className={styles.colEmpty}>Nada listo aún</div>
            ) : (
              ready.map(t => (
                <TicketCard key={t.id} ticket={t}
                  onAdvance={handleAdvance} onBack={handleBack} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: Nuevo ticket ─────────────────── */}
      <Modal isOpen={isOpen} onClose={() => setOpen(false)} title="Nuevo Ticket de Cocina" size="lg">
        <div className={styles.ticketForm}>
          <div className={styles.row3}>
            <Input label="Mesa" id="tk-table" placeholder="T01" value={newTicket.tableId}
              onChange={e => setNewTicket(f => ({ ...f, tableId: e.target.value }))} required />
            <Input label="Cliente" id="tk-client" placeholder="Nombre" value={newTicket.clientName}
              onChange={e => setNewTicket(f => ({ ...f, clientName: e.target.value }))} required />
            <Select label="Prioridad" id="tk-prio" value={newTicket.priority}
              onChange={e => setNewTicket(f => ({ ...f, priority: e.target.value }))}>
              <option value="normal">Normal</option>
              <option value="high">Alta ⚠️</option>
            </Select>
          </div>

          <div className={styles.menuSection}>
            <p className={styles.menuTitle}>Seleccionar ítems del pedido:</p>
            {categories.map(cat => (
              <div key={cat} className={styles.menuCategory}>
                <h4 className={styles.catName}>{cat}</h4>
                <div className={styles.menuGrid}>
                  {MENU_ITEMS.filter(m => m.category === cat).map(item => {
                    const isSelected = selectedItems.some(i => i.menuId === item.id)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.menuBtn} ${isSelected ? styles.menuBtnSel : ''}`}
                        onClick={() => toggleItem(item)}
                      >
                        <span>{item.name}</span>
                        <span className={styles.menuTime}>{item.time} min</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <Textarea label="Notas especiales" id="tk-notes" placeholder="Alergias, solicitudes..."
            value={newTicket.notes}
            onChange={e => setNewTicket(f => ({ ...f, notes: e.target.value }))} />

          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" icon={<ChefHat size={15} />} onClick={handleCreateTicket}>
              Crear ticket ({selectedItems.length} ítems)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

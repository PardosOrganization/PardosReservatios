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
import { ChefHat, Plus, Clock, AlertTriangle, CheckCircle2, Flame, Receipt, X, BadgePercent } from 'lucide-react'
import {
  useKitchen,
  TICKET_STATUS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  MENU_ITEMS,
} from '../../context/KitchenContext'
import { useAuth, ROLE_PERMISSIONS } from '../../context/AuthContext'
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
function TicketCard({ ticket, perms, onAddItems, onRemoveItem, onRequestBill, onDiscount }) {
  const { updateItemStatus, updateTicketStatus, updateTicket } = useKitchen()
  const color = TICKET_STATUS_COLORS[ticket.status]
  const canBill = perms.canRequestBill && !ticket.billRequested &&
    [TICKET_STATUS.READY, TICKET_STATUS.SERVED].includes(ticket.status)

  const readyItemsCount = ticket.items.filter(i => i.status === 'ready').length
  const totalItemsCount = ticket.items.length

  const handlePrepareAll = () => {
    if (!perms.canUpdateKitchenStatus) return
    const newItems = ticket.items.map(i => ({ ...i, status: i.status === 'ready' ? 'ready' : 'preparing' }))
    updateTicket(ticket.id, { items: newItems })
    updateTicketStatus(ticket.id, TICKET_STATUS.PREPARING)
  }

  const handleReadyAll = () => {
    if (!perms.canUpdateKitchenStatus) return
    const newItems = ticket.items.map(i => ({ ...i, status: 'ready' }))
    updateTicket(ticket.id, { items: newItems })
    updateTicketStatus(ticket.id, TICKET_STATUS.READY)
  }

  const handleServe = () => {
    if (!perms.canUpdateKitchenStatus) return
    updateTicketStatus(ticket.id, TICKET_STATUS.SERVED)
  }

  const handleItemClick = (item, idx) => {
    if (!perms.canUpdateKitchenStatus) return

    let newStatus = 'pending'
    if (item.status === 'pending' || !item.status) newStatus = 'preparing'
    else if (item.status === 'preparing') newStatus = 'ready'
    else return // Ya está listo, no retrocede

    updateItemStatus(ticket.id, item.menuId, newStatus)
    
    // Auto-advance ticket status based on all items
    const allItems = [...ticket.items]
    allItems[idx] = { ...item, status: newStatus }

    const allReady = allItems.every(i => i.status === 'ready')
    const anyPreparingOrReady = allItems.some(i => i.status === 'preparing' || i.status === 'ready')
    const allPending = allItems.every(i => i.status === 'pending' || !i.status)

    if (allReady && ticket.status !== TICKET_STATUS.READY) {
      updateTicketStatus(ticket.id, TICKET_STATUS.READY)
    } else if (!allReady && anyPreparingOrReady && ticket.status !== TICKET_STATUS.PREPARING) {
      updateTicketStatus(ticket.id, TICKET_STATUS.PREPARING)
    } else if (allPending && ticket.status !== TICKET_STATUS.PENDING) {
      updateTicketStatus(ticket.id, TICKET_STATUS.PENDING)
    }
  }

  const getItemStatusLabel = (status) => {
    if (status === 'ready') return 'Listo ✓'
    if (status === 'preparing') return 'Preparando >'
    return 'Pendiente >'
  }

  const getItemStatusClass = (status) => {
    if (status === 'ready') return styles.itemStatusReady
    if (status === 'preparing') return styles.itemStatusPreparing
    return styles.itemStatusPending
  }

  return (
    <article className={`${styles.ticket} ${ticket.priority === 'high' ? styles.ticketHigh : ''}`}
      style={{ borderTopColor: color }}>
      {ticket.priority === 'high' && (
        <div className={styles.priorityBadge}>
          <AlertTriangle size={11} /> Alta prioridad
        </div>
      )}
      
      {/* Nuevo Header idéntico al mockup */}
      <div className={styles.ticketHeaderMockup}>
        <div className={styles.ticketHeaderRow}>
          <span className={styles.ticketTableMockup}>MESA {ticket.tableId}</span>
          <div className={styles.ticketTimerWrapper}>
            <ElapsedTimer createdAt={ticket.createdAt} />
          </div>
        </div>
        <div className={styles.ticketHeaderRow}>
          <h3 className={styles.ticketClientMockup}>{ticket.clientName}</h3>
          <span className={styles.ticketGuestsMockup}>👥 {ticket.guests}</span>
        </div>
        <div className={styles.ticketProgress}>
          {readyItemsCount}/{totalItemsCount} ítems listos
        </div>
      </div>

      {/* Items con botones individuales */}
      <ul className={styles.itemList}>
        {ticket.items.map((item, i) => (
          <li key={i} className={styles.itemRowMockup}>
            <div className={styles.itemInfoMockup}>
              <span className={styles.itemQtyMockup}>{item.qty}×</span>
              <span className={styles.itemNameMockup}>{item.name}</span>
              {item.notes && <span className={styles.itemNote}>({item.notes})</span>}
            </div>
            
            <div className={styles.itemActionsMockup}>
              {perms.canUpdateKitchenStatus ? (
                <button 
                  className={`${styles.itemStatusBtn} ${getItemStatusClass(item.status)}`}
                  onClick={() => handleItemClick(item, i)}
                >
                  {getItemStatusLabel(item.status)}
                </button>
              ) : (
                <span className={`${styles.itemStatusBtn} ${getItemStatusClass(item.status)} ${styles.itemStatusDisabled}`}>
                   {getItemStatusLabel(item.status).replace(' >', '')}
                </span>
              )}
              
              {perms.canRemoveOrderItems && ticket.items.length > 1 && (
                <button
                  type="button"
                  className={styles.removeItemBtn}
                  title="Eliminar producto"
                  onClick={() => onRemoveItem(ticket, i)}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Badges de estado del pedido */}
      {ticket.billRequested && (
        <p className={styles.ticketNote} style={{ color: '#2c3e88' }}>
          <Receipt size={12} /> Pre-cuenta solicitada
        </p>
      )}
      {ticket.discount > 0 && (
        <p className={styles.ticketNote} style={{ color: '#27ae60' }}>
          <BadgePercent size={12} /> Descuento autorizado: S/ {Number(ticket.discount).toFixed(2)} ({ticket.discountBy})
        </p>
      )}

      {/* Notas especiales */}
      {ticket.notes && (
        <p className={styles.ticketNote}>
          <AlertTriangle size={12} /> {ticket.notes}
        </p>
      )}

      {/* Acciones */}
      <div className={styles.ticketActions}>
        {perms.canUpdateKitchenStatus && ticket.items.length > 1 && ticket.status === TICKET_STATUS.PENDING && (
          <Button variant="primary" size="sm" icon={<Flame size={13} />} onClick={handlePrepareAll} style={{ backgroundColor: '#2b5c8f', color: 'white' }}>
            Preparar todo
          </Button>
        )}
        {perms.canUpdateKitchenStatus && ticket.items.length > 1 && ticket.status === TICKET_STATUS.PREPARING && (
          <Button variant="success" size="sm" icon={<CheckCircle2 size={13} />} onClick={handleReadyAll}>
            Todo listo
          </Button>
        )}
        {perms.canUpdateKitchenStatus && ticket.status === TICKET_STATUS.READY && (
          <Button variant="ghost" size="sm" icon={<CheckCircle2 size={13} />} onClick={handleServe} style={{ color: '#27ae60', border: '1px solid #27ae60' }}>
            Despachar (Borrar)
          </Button>
        )}
        {perms.canAddOrderItems && ticket.status !== TICKET_STATUS.SERVED && (
          <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={() => onAddItems(ticket)}>
            Ítems
          </Button>
        )}
        {canBill && (
          <Button variant="secondary" size="sm" icon={<Receipt size={13} />} onClick={() => onRequestBill(ticket)}>
            Pre-cuenta
          </Button>
        )}
        {perms.canApplyDiscounts && !ticket.paid && (
          <Button variant="ghost" size="sm" icon={<BadgePercent size={13} />} onClick={() => onDiscount(ticket)}>
            Descuento
          </Button>
        )}
      </div>
    </article>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function KitchenPage() {
  const { activeTickets, tickets, pendingCount, preparingCount, readyCount,
          addTicket, updateTicketStatus, updateTicket } = useKitchen()
  const { user } = useAuth()
  const perms = ROLE_PERMISSIONS[user?.role] || {}

  const [isOpen, setOpen] = useState(false)
  const [newTicket, setNewTicket] = useState({
    tableId: '', clientName: '', guests: 2,
    priority: 'normal', notes: '', items: [],
  })
  const [selectedItems, setSelected] = useState([])
  const [addItemsTicket, setAddItemsTicket] = useState(null)   // ticket al que se agregan ítems
  const [extraItems, setExtraItems] = useState([])
  const [discountTicket, setDiscountTicket] = useState(null)
  const [discountAmount, setDiscountAmount] = useState('')

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
      // Incluir el precio: la caja lo necesita para calcular el total del cobro
      return [...prev, { menuId: item.id, name: item.name, price: item.price, qty: 1, notes: '' }]
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
    addTicket({ ...newTicket, items: selectedItems, createdBy: user?.name })
    toast.success('Comanda enviada a cocina')
    setOpen(false)
    setNewTicket({ tableId: '', clientName: '', guests: 2, priority: 'normal', notes: '', items: [] })
    setSelected([])
  }

  // ── Agregar ítems a una orden existente (mozo / líder) ─────────────────────
  const toggleExtraItem = (item) => {
    setExtraItems(prev => {
      const exists = prev.find(i => i.menuId === item.id)
      if (exists) return prev.filter(i => i.menuId !== item.id)
      return [...prev, { menuId: item.id, name: item.name, price: item.price, qty: 1, notes: '' }]
    })
  }

  const handleAddItems = () => {
    if (extraItems.length === 0) { toast.error('Selecciona al menos un ítem'); return }
    updateTicket(addItemsTicket.id, { items: [...addItemsTicket.items, ...extraItems] })
    toast.success(`${extraItems.length} ítem(s) agregado(s) a la orden de Mesa ${addItemsTicket.tableId}`)
    setAddItemsTicket(null)
    setExtraItems([])
  }

  // ── Eliminar producto de una orden (solo Líder) ─────────────────────────────
  const handleRemoveItem = (ticket, index) => {
    const removed = ticket.items[index]
    updateTicket(ticket.id, {
      items: ticket.items.filter((_, i) => i !== index),
      removals: [...(ticket.removals || []), { name: removed.name, qty: removed.qty, by: user?.name, at: new Date().toISOString() }],
    })
    toast.success(`"${removed.name}" eliminado de la orden por ${user?.name}`)
  }

  // ── Pre-cuenta (mozo / líder) ───────────────────────────────────────────────
  const handleRequestBill = (ticket) => {
    updateTicket(ticket.id, { billRequested: true, billRequestedBy: user?.name })
    toast.success(`Pre-cuenta solicitada para Mesa ${ticket.tableId} — visible en Caja`)
  }

  // ── Descuento autorizado (solo Líder) ───────────────────────────────────────
  const handleApplyDiscount = () => {
    const amount = Number(discountAmount)
    if (!amount || amount <= 0) { toast.error('Ingresa un monto de descuento válido'); return }
    updateTicket(discountTicket.id, { discount: amount, discountBy: user?.name })
    toast.success(`Descuento de S/ ${amount.toFixed(2)} autorizado para Mesa ${discountTicket.tableId}`)
    setDiscountTicket(null)
    setDiscountAmount('')
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
        {perms.canCreateKitchenOrders && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)} id="btn-nuevo-ticket">
            Nuevo Ticket
          </Button>
        )}
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
                <TicketCard key={t.id} ticket={t} perms={perms}
                  onAdvance={handleAdvance} onBack={handleBack}
                  onAddItems={setAddItemsTicket} onRemoveItem={handleRemoveItem}
                  onRequestBill={handleRequestBill} onDiscount={setDiscountTicket} />
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
                <TicketCard key={t.id} ticket={t} perms={perms}
                  onAdvance={handleAdvance} onBack={handleBack}
                  onAddItems={setAddItemsTicket} onRemoveItem={handleRemoveItem}
                  onRequestBill={handleRequestBill} onDiscount={setDiscountTicket} />
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
                <TicketCard key={t.id} ticket={t} perms={perms}
                  onAdvance={handleAdvance} onBack={handleBack}
                  onAddItems={setAddItemsTicket} onRemoveItem={handleRemoveItem}
                  onRequestBill={handleRequestBill} onDiscount={setDiscountTicket} />
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

      {/* ── Modal: Agregar ítems a una orden existente ── */}
      <Modal isOpen={!!addItemsTicket} onClose={() => { setAddItemsTicket(null); setExtraItems([]) }}
        title={addItemsTicket ? `Agregar ítems — Mesa ${addItemsTicket.tableId}` : ''} size="lg">
        <div className={styles.ticketForm}>
          <div className={styles.menuSection}>
            <p className={styles.menuTitle}>Selecciona los ítems a agregar a la orden:</p>
            {categories.map(cat => (
              <div key={cat} className={styles.menuCategory}>
                <h4 className={styles.catName}>{cat}</h4>
                <div className={styles.menuGrid}>
                  {MENU_ITEMS.filter(m => m.category === cat).map(item => {
                    const isSelected = extraItems.some(i => i.menuId === item.id)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.menuBtn} ${isSelected ? styles.menuBtnSel : ''}`}
                        onClick={() => toggleExtraItem(item)}
                      >
                        <span>{item.name}</span>
                        <span className={styles.menuTime}>S/ {item.price.toFixed(2)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => { setAddItemsTicket(null); setExtraItems([]) }}>Cancelar</Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={handleAddItems}>
              Agregar a la orden ({extraItems.length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Descuento autorizado (Líder) ── */}
      <Modal isOpen={!!discountTicket} onClose={() => { setDiscountTicket(null); setDiscountAmount('') }}
        title={discountTicket ? `Autorizar descuento — Mesa ${discountTicket.tableId}` : ''} size="sm">
        <div className={styles.ticketForm}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            El descuento quedará registrado a tu nombre y se aplicará automáticamente
            cuando Caja cobre esta orden.
          </p>
          <Input label="Monto del descuento (S/)" id="disc-amount" type="number" min={0} step={0.1}
            placeholder="0.00" value={discountAmount}
            onChange={e => setDiscountAmount(e.target.value)} />
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => { setDiscountTicket(null); setDiscountAmount('') }}>Cancelar</Button>
            <Button variant="success" icon={<BadgePercent size={15} />} onClick={handleApplyDiscount}>
              Autorizar descuento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

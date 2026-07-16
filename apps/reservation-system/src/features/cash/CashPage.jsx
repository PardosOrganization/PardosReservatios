/**
 * src/features/cash/CashPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo de Caja — exclusivo para el rol de Cajero (y visible por Admin).
 * Funcionalidades:
 *   - Abrir / cerrar turno de caja con monto de apertura
 *   - Registrar cobros con ítems del menú, precio unitario y total calculado
 *   - Generar boleta de venta con desglose de ítems, IGV y total
 *   - Ver resumen del turno actual: total cobrado por método de pago
 *   - Historial de cobros del día con detalle de boleta al hacer clic
 *
 * Acceso: Cajero, Administrador
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef } from 'react'
import { CreditCard, DollarSign, Plus, Clock, CheckCircle, X, Printer, Receipt, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useCash, PAYMENT_METHODS } from '../../context/CashContext'
import { useAuth, ROLE_PERMISSIONS } from '../../context/AuthContext'
import { MENU_ITEMS, useKitchen, TICKET_STATUS } from '../../context/KitchenContext'
import { useReservations } from '../../context/ReservationContext'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import toast from 'react-hot-toast'
import styles from './CashPage.module.css'

const IGV_RATE = 0.18   // 18% IGV peruano

const EMPTY_PAYMENT = {
  clientName: '',
  method: 'efectivo',
  guests: '',
  notes: '',
  items: [],
}

// ── Boleta imprimible ─────────────────────────────────────────────────────────
function Boleta({ payment, onClose }) {
  if (!payment) return null
  const method = PAYMENT_METHODS.find(m => m.id === payment.method)
  const subtotal = payment.amount / (1 + IGV_RATE)
  const igv      = payment.amount - subtotal
  const hasItems = payment.items && payment.items.length > 0

  return (
    <div className={styles.boleta}>
      {/* Header */}
      <div className={styles.boletaHeader}>
        <div className={styles.boletaLogo}>🍗</div>
        <h2 className={styles.boletaTitle}>Pardos Chicken</h2>
        <p className={styles.boletaSub}>Sistema de Reservas — Miraflores</p>
        <p className={styles.boletaInfo}>RUC: 20123456789</p>
        <div className={styles.boletaDivider} />
        <p className={styles.boletaType}>BOLETA DE VENTA ELECTRÓNICA</p>
        <p className={styles.boletaNum}>N° {payment.id}</p>
      </div>

      {/* Datos del cliente */}
      <div className={styles.boletaSection}>
        <div className={styles.boletaRow2}>
          <span>Fecha:</span>
          <strong>{payment.date} {payment.time}</strong>
        </div>
        <div className={styles.boletaRow2}>
          <span>Cliente:</span>
          <strong>{payment.clientName}</strong>
        </div>
        <div className={styles.boletaRow2}>
          <span>Personas:</span>
          <strong>{payment.guests}</strong>
        </div>
        <div className={styles.boletaRow2}>
          <span>Cajero:</span>
          <strong>{payment.cashierName}</strong>
        </div>
      </div>

      <div className={styles.boletaDivider} />

      {/* Ítems */}
      {hasItems ? (
        <div className={styles.boletaItems}>
          <div className={styles.boletaItemHeader}>
            <span>Descripción</span>
            <span>Cant.</span>
            <span>P.Unit</span>
            <span>Total</span>
          </div>
          {payment.items.map((item, i) => (
            <div key={i} className={styles.boletaItem}>
              <span className={styles.boletaItemName}>{item.name}</span>
              <span className={styles.boletaItemQty}>{item.qty}</span>
              <span>S/ {(item.price || 0).toFixed(2)}</span>
              <span className={styles.boletaItemTotal}>S/ {((item.price || 0) * item.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.boletaNoItems}>
          <p>Consumo general</p>
        </div>
      )}

      <div className={styles.boletaDivider} />

      {/* Totales */}
      <div className={styles.boletaTotals}>
        <div className={styles.boletaRow2}>
          <span>Subtotal (sin IGV):</span>
          <span>S/ {subtotal.toFixed(2)}</span>
        </div>
        <div className={styles.boletaRow2}>
          <span>IGV (18%):</span>
          <span>S/ {igv.toFixed(2)}</span>
        </div>
        <div className={`${styles.boletaRow2} ${styles.boletaTotal}`}>
          <span>TOTAL:</span>
          <strong>S/ {payment.amount.toFixed(2)}</strong>
        </div>
        <div className={styles.boletaRow2}>
          <span>Método de pago:</span>
          <span>{method?.icon} {method?.label}</span>
        </div>
      </div>

      {payment.notes && (
        <>
          <div className={styles.boletaDivider} />
          <p className={styles.boletaNotes}>Nota: {payment.notes}</p>
        </>
      )}

      <div className={styles.boletaDivider} />
      <p className={styles.boletaFoot}>¡Gracias por su preferencia!</p>
      <p className={styles.boletaFoot}>www.pardoschicken.pe</p>

      <div className={styles.boletaActions}>
        <Button variant="primary" icon={<Printer size={15} />} onClick={() => window.print()} fullWidth id="btn-imprimir-boleta">
          Imprimir boleta
        </Button>
        <Button variant="ghost" onClick={onClose} fullWidth>Cerrar</Button>
      </div>
    </div>
  )
}

// ── Fila de pago en historial ─────────────────────────────────────────────────
function PaymentRow({ p, onViewBoleta, canVoid, onVoid }) {
  const [expanded, setExpanded] = useState(false)
  const method = PAYMENT_METHODS.find(m => m.id === p.method)
  const hasItems = p.items && p.items.length > 0
  const isVoided = p.status === 'anulado'

  return (
    <div className={styles.paymentEntry} style={isVoided ? { opacity: 0.55 } : undefined}>
      <div className={styles.paymentItem} onClick={() => hasItems && setExpanded(v => !v)}>
        <span className={styles.payIcon}>{method?.icon || '💰'}</span>
        <div className={styles.payInfo}>
          <span className={styles.payClient}>
            {p.clientName}
            {isVoided && <span style={{ color: '#e8453c', fontWeight: 700, marginLeft: 6, fontSize: 11 }}>ANULADO</span>}
          </span>
          <span className={styles.payMeta}>
            {p.time} · {method?.label} · {p.guests} pers.
            {isVoided && p.voidReason ? ` · Motivo: ${p.voidReason}` : ''}
          </span>
        </div>
        <span className={styles.payAmount} style={isVoided ? { textDecoration: 'line-through' } : undefined}>
          S/ {p.amount.toFixed(2)}
        </span>
        <div className={styles.payActions}>
          <button className={styles.iconBtn} title="Ver boleta" onClick={e => { e.stopPropagation(); onViewBoleta(p) }}>
            <Receipt size={14} />
          </button>
          {canVoid && !isVoided && (
            <button className={styles.iconBtn} title="Anular cuenta (solo Líder)" style={{ color: '#e8453c' }}
              onClick={e => { e.stopPropagation(); onVoid(p) }}>
              <X size={14} />
            </button>
          )}
          {hasItems && (
            <button className={styles.iconBtn} title="Ver pedido" onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>
      {expanded && hasItems && (
        <div className={styles.payItemList}>
          {p.items.map((item, i) => (
            <div key={i} className={styles.payItemRow}>
              <span className={styles.payItemName}>{item.qty}× {item.name}</span>
              <span className={styles.payItemPrice}>S/ {((item.price || 0) * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className={styles.payItemTotal}>
            <span>Total</span>
            <strong>S/ {p.amount.toFixed(2)}</strong>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CashPage() {
  const { user } = useAuth()
  const perms = ROLE_PERMISSIONS[user?.role] || {}
  const { payments, todayPayments, todayTotal, todayByMethod, shift, openShift, closeShift, addPayment, voidPayment } = useCash()
  const { tickets, updateTicket } = useKitchen()
  const { reservations, completeReservation } = useReservations()
  
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])

  const [isPaymentOpen, setPaymentOpen] = useState(false)
  const [isShiftOpen,   setShiftOpen]   = useState(false)
  const [boletaPayment, setBoletaPayment] = useState(null)
  const [shiftModal,    setShiftModal]  = useState(false)
  const [form,          setForm]        = useState(EMPTY_PAYMENT)
  const [errors,        setErrors]      = useState({})
  const [initialCash,   setInitialCash] = useState('')
  const [closePreview,  setClosePreview] = useState(null)
  const [voidTarget,    setVoidTarget]  = useState(null)
  const [voidReason,    setVoidReason]  = useState('')

  // Ítems del pedido en el formulario
  const [orderItems, setOrderItems] = useState([])
  // Ticket de cocina seleccionado para cobrar (pre-cuenta)
  const [selectedTicketId, setSelectedTicketId] = useState('')

  // Tickets cobrables: listos/servidos o con pre-cuenta solicitada, sin pagar
  const billableTickets = tickets.filter(t =>
    !t.paid &&
    (t.billRequested || [TICKET_STATUS.READY, TICKET_STATUS.SERVED].includes(t.status))
  )
  const selectedTicket = billableTickets.find(t => t.id === selectedTicketId) || null

  // Descuento pre-autorizado por el Líder en el ticket seleccionado
  const authorizedDiscount = selectedTicket?.discount ? Number(selectedTicket.discount) : 0

  const orderSubtotal = orderItems.reduce((s, i) => s + (i.price || 0) * i.qty, 0)
  const orderTotal = Math.max(0, orderSubtotal - authorizedDiscount)

  // El cajero no arma órdenes manualmente: debe cobrar desde un ticket
  const canEditItems = perms.canAddOrderItems

  const handleSelectTicket = (id) => {
    setSelectedTicketId(id)
    const t = billableTickets.find(x => x.id === id)
    if (t) {
      setForm(f => ({ ...f, clientName: t.clientName, guests: String(t.guests || 1) }))
      setOrderItems(t.items.map(i => ({ menuId: i.menuId, name: i.name, price: i.price || 0, qty: i.qty })))
    } else {
      setOrderItems([])
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(e => ({ ...e, [name]: '' }))
  }

  const addOrderItem = (menuItem) => {
    setOrderItems(prev => {
      const exists = prev.find(i => i.menuId === menuItem.id)
      if (exists) return prev.map(i => i.menuId === menuItem.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { menuId: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1 }]
    })
  }

  const removeOrderItem = (menuId) => {
    setOrderItems(prev => prev.filter(i => i.menuId !== menuId))
  }

  const updateQty = (menuId, delta) => {
    setOrderItems(prev => prev
      .map(i => i.menuId === menuId ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    )
  }

  const validate = () => {
    const e = {}
    if (!form.clientName.trim()) e.clientName = 'Nombre requerido'
    if (!form.method) e.method = 'Método de pago requerido'
    if (orderItems.length === 0) {
      e.items = canEditItems
        ? 'Agrega al menos un ítem al pedido'
        : 'Selecciona el ticket de cocina a cobrar'
    } else if (orderTotal <= 0) {
      e.items = 'El total del pedido es S/ 0.00: revisa los precios de los ítems'
    }
    return e
  }

  const handleRegisterPayment = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const newPayment = addPayment({
      ...form,
      amount:      orderTotal,
      discount:    authorizedDiscount,
      discountBy:  selectedTicket?.discountBy || null,
      ticketId:    selectedTicket?.id || null,
      guests:      Number(form.guests) || 1,
      items:       orderItems,
      cashierId:   user.id,
      cashierName: user.name,
    })

    // Cierra formalmente la mesa: el ticket queda pagado y servido
    if (selectedTicket) {
      updateTicket(selectedTicket.id, { paid: true, status: TICKET_STATUS.SERVED, billRequested: false })
      if (selectedTicket.reservationId) {
        completeReservation(selectedTicket.reservationId)
      }
    }
    
    // Si la reserva se cobró desde el panel de reservas (mockup)
    if (form.reservationId) {
      completeReservation(form.reservationId)
    }

    toast.success(`Boleta generada: S/ ${orderTotal.toFixed(2)}`)
    setBoletaPayment(newPayment)
    setForm(EMPTY_PAYMENT)
    setOrderItems([])
    setSelectedTicketId('')
    setPaymentOpen(false)
  }

  const handleVoidPayment = () => {
    voidPayment(voidTarget.id, voidReason, user.name)
    toast.success(`Cuenta ${voidTarget.id} anulada por ${user.name}`)
    setVoidTarget(null)
    setVoidReason('')
  }

  const handleOpenShift = () => {
    openShift({ id: user.id, name: user.name }, Number(initialCash) || 0)
    toast.success('Turno de caja abierto')
    setShiftOpen(false)
    setInitialCash('')
  }

  const handleCloseShift = () => {
    const summary = closeShift()
    setClosePreview(summary)
    setShiftModal(true)
    toast.success('Turno cerrado correctamente')
  }

  const shiftDuration = shift
    ? Math.round((Date.now() - new Date(shift.openedAt).getTime()) / 60000)
    : 0

  // Agrupar menú por categoría
  const categories = [...new Set(MENU_ITEMS.map(m => m.category))]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Caja</h1>
          <p className={styles.subtitle}>Módulo de cobros, boletas y gestión de turno</p>
        </div>
        <div className={styles.headerActions}>
          {perms.canManageCash && (shift ? (
            <>
              {perms.canProcessPayments && (
                <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setPaymentOpen(true)} id="btn-nuevo-cobro">
                  Nuevo cobro
                </Button>
              )}
              <Button variant="danger" icon={<X size={16} />} onClick={handleCloseShift} id="btn-cerrar-turno">
                Cerrar turno
              </Button>
            </>
          ) : (
            <Button variant="primary" icon={<CreditCard size={16} />} onClick={() => setShiftOpen(true)} id="btn-abrir-turno">
              Abrir turno
            </Button>
          ))}
        </div>
      </div>

      {/* Estado del turno */}
      {shift ? (
        <div className={styles.shiftBanner}>
          <div className={styles.shiftIndicator} />
          <div>
            <span className={styles.shiftLabel}>Turno activo</span>
            <span className={styles.shiftInfo}>
              Cajero: <strong>{shift.cashierName}</strong> · Abierto hace {shiftDuration} minutos
            </span>
          </div>
          <div className={styles.shiftCash}>
            <span>Apertura:</span>
            <strong>S/ {shift.initialCash?.toFixed(2) || '0.00'}</strong>
          </div>
        </div>
      ) : (
        <div className={styles.noShiftBanner}>
          <CreditCard size={20} /> No hay turno de caja activo. Abre un turno para empezar a cobrar.
        </div>
      )}

      {/* Stats del día */}
      <div className={styles.statsGrid}>
        <StatCard label="Total hoy"       value={`S/ ${todayTotal.toFixed(2)}`}  icon={<DollarSign size={22} />} color="success" />
        <StatCard label="Cobros"          value={todayPayments.length}            icon={<CreditCard size={22} />} color="info" />
        <StatCard label="Promedio"        value={`S/ ${todayPayments.length > 0 ? (todayTotal / todayPayments.length).toFixed(2) : '0.00'}`} icon={<CheckCircle size={22} />} color="primary" />
        <StatCard label="IGV (18%)"       value={`S/ ${(todayTotal * IGV_RATE / (1 + IGV_RATE)).toFixed(2)}`} icon={<Receipt size={22} />} color="warning" />
      </div>

      {/* Reservas pendientes de cobro (Mockup) */}
      <Card title="Reservas pendientes de cobro" subtitle="Selecciona una reserva para cobrar">
        <div style={{ marginBottom: 12, width: '200px' }}>
          <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        </div>
        <div className={styles.reservationList}>
          {reservations.filter(r => r.date === filterDate && r.status === 'seated').length === 0 ? (
            <p className={styles.empty}>No hay reservas en mesa para esta fecha</p>
          ) : (
             reservations.filter(r => r.date === filterDate && r.status === 'seated').map(r => (
               <div key={r.id} className={styles.resRow}>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <span className={styles.resTable}>MESA {r.tableId}</span>
                   <span className={styles.resClient}>{r.clientName}</span>
                 </div>
                 <span className={styles.resStatus}>En mesa</span>
                 <Button size="sm" variant="success" onClick={() => {
                     setForm(f => ({ ...f, clientName: r.clientName, guests: String(r.guests), reservationId: r.id }))
                     setPaymentOpen(true)
                 }}>$ Cobrar</Button>
               </div>
             ))
          )}
        </div>
      </Card>

      <div className={styles.grid2}>
        {/* Métodos de pago */}
        <Card title="Cobros por método" subtitle="Resumen del día">
          <div className={styles.methodList}>
            {PAYMENT_METHODS.map(m => {
              const amount = todayByMethod[m.id] || 0
              const pct    = todayTotal > 0 ? (amount / todayTotal) * 100 : 0
              return (
                <div key={m.id} className={styles.methodItem}>
                  <span className={styles.methodIcon}>{m.icon}</span>
                  <div className={styles.methodInfo}>
                    <div className={styles.methodHeader}>
                      <span className={styles.methodLabel}>{m.label}</span>
                      <span className={styles.methodAmount}>S/ {amount.toFixed(2)}</span>
                    </div>
                    <div className={styles.methodBar}>
                      <div className={styles.methodFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.methodPct}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Historial del día */}
        <Card title="Cobros del día" subtitle={`${todayPayments.length} transacciones · S/ ${todayTotal.toFixed(2)}`} noPadding>
          {todayPayments.length === 0 ? (
            <div className={styles.empty}>
              <CreditCard size={36} />
              <p>No hay cobros registrados hoy</p>
            </div>
          ) : (
            <div className={styles.paymentList}>
              {todayPayments.map(p => (
                <PaymentRow key={p.id} p={p} onViewBoleta={setBoletaPayment}
                  canVoid={perms.canVoidPayments} onVoid={setVoidTarget} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Modal: Nuevo cobro ──────────────────── */}
      <Modal isOpen={isPaymentOpen} onClose={() => { setPaymentOpen(false); setOrderItems([]); setSelectedTicketId('') }}
        title="Registrar Cobro" size="lg">
        <form onSubmit={handleRegisterPayment} className={styles.form} noValidate>
          
          <div className={styles.row2}>
            <Input label="Fecha de reserva" name="date" type="date" value={filterDate} disabled />
            <Input label="Nombre del cliente" name="clientName" id="pay-client"
              placeholder="Nombre del cliente" value={form.clientName}
              onChange={handleChange} error={errors.clientName} required />
          </div>

          <div className={styles.row2}>
            <Select label="Vincular a Reserva (Opcional)" value="">
              <option value="">{form.clientName ? form.clientName : 'Seleccionar...'}</option>
            </Select>
            <div className={styles.row2}>
              <Input label="N° personas" name="guests" id="pay-guests" type="number"
                min={1} max={20} placeholder="2"
                value={form.guests} onChange={handleChange} />
              <Select label="Método de pago" name="method" id="pay-method"
                value={form.method} onChange={handleChange} error={errors.method} required>
                {PAYMENT_METHODS.map(m => (
                  <option key={m.id} value={m.id}>{m.icon} {m.label}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Ticket de cocina a cobrar */}
          <Select label="Ticket de cocina" id="pay-ticket"
            value={selectedTicketId} onChange={e => handleSelectTicket(e.target.value)}>
            <option value="">Seleccionar ticket...</option>
            {billableTickets.map(t => (
              <option key={t.id} value={t.id}>
                Mesa {t.tableId} — {t.clientName} ({t.items.length} ítems{t.billRequested ? ' · pre-cuenta' : ''})
              </option>
            ))}
          </Select>

          {/* Selector de ítems del menú */}
          <div className={styles.menuSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className={styles.menuTitle}>🍴 Platos servidos por cocina · puedes ajustar antes de cobrar</p>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Código para reclamos: 698611</span>
            </div>
            
            {errors.items && <p className={styles.errorText}>{errors.items}</p>}

            <div className={styles.orderSideMockup}>
              {orderItems.length === 0 ? (
                <p className={styles.orderEmpty}>Selecciona un ticket para cargar la orden</p>
              ) : (
                <div className={styles.orderList}>
                  {orderItems.map(item => {
                    const ticketItem = selectedTicket?.items?.find(i => i.menuId === item.menuId);
                    const isPending = ticketItem && ticketItem.status !== 'ready';
                    return (
                      <div key={item.menuId} className={styles.orderRowMockup}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <span className={styles.orderName}>{item.qty}x {item.name}</span>
                          {isPending && <span className={styles.missingBadge}>Falta servir</span>}
                        </div>
                        <span className={styles.orderPrice}>S/ {((item.price || 0) * item.qty).toFixed(2)}</span>
                      </div>
                    )
                  })}
                  <div style={{ marginTop: 8 }}>
                    <Button type="button" variant="ghost" size="sm" style={{ border: '1px dashed var(--color-primary)', color: 'var(--color-primary)' }}>
                      + Editar pedido · {orderItems.length} ítems
                    </Button>
                  </div>
                  
                  <div className={styles.orderTotalRow} style={{ marginTop: 16 }}>
                    <span>Subtotal</span>
                    <span>S/ {(orderTotal / (1 + IGV_RATE)).toFixed(2)}</span>
                  </div>
                  <div className={styles.orderTotalRow}>
                    <span>IGV (18%)</span>
                    <span>S/ {(orderTotal - orderTotal / (1 + IGV_RATE)).toFixed(2)}</span>
                  </div>
                  {authorizedDiscount > 0 && (
                    <div className={styles.orderTotalRow} style={{ color: '#27ae60' }}>
                      <span>Descuento autorizado ({selectedTicket?.discountBy})</span>
                      <span>− S/ {authorizedDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className={`${styles.orderTotalRow} ${styles.grandTotal}`}>
                    <strong>TOTAL A COBRAR</strong>
                    <strong>S/ {orderTotal.toFixed(2)}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.formActions}>
            <Button type="button" variant="ghost" onClick={() => { setPaymentOpen(false); setOrderItems([]); setSelectedTicketId('') }}>Cancelar</Button>
            <Button type="submit" variant="success" icon={<Receipt size={15} />}
              disabled={orderItems.length === 0 || orderTotal <= 0}>
              Confirmar Pago y Generar Boleta
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Anular cuenta (solo Líder) ────── */}
      <Modal isOpen={!!voidTarget} onClose={() => { setVoidTarget(null); setVoidReason('') }}
        title="Anular Cuenta" size="sm">
        {voidTarget && (
          <div className={styles.shiftForm}>
            <p className={styles.shiftDesc}>
              Vas a anular la boleta <strong>{voidTarget.id}</strong> de{' '}
              <strong>{voidTarget.clientName}</strong> por{' '}
              <strong>S/ {voidTarget.amount.toFixed(2)}</strong>. La anulación queda
              registrada a tu nombre y el monto se excluye de los totales del turno.
            </p>
            <Input label="Motivo de la anulación" id="void-reason" placeholder="Error de cobro, devolución..."
              value={voidReason} onChange={e => setVoidReason(e.target.value)} />
            <div className={styles.formActions}>
              <Button variant="ghost" onClick={() => { setVoidTarget(null); setVoidReason('') }}>Cancelar</Button>
              <Button variant="danger" icon={<X size={15} />} onClick={handleVoidPayment}>
                Anular cuenta
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Boleta ───────────────────────── */}
      <Modal isOpen={!!boletaPayment} onClose={() => setBoletaPayment(null)} title="Boleta de Venta" size="sm">
        <Boleta payment={boletaPayment} onClose={() => setBoletaPayment(null)} />
      </Modal>

      {/* ── Modal: Abrir turno ──────────────────── */}
      <Modal isOpen={isShiftOpen} onClose={() => setShiftOpen(false)} title="Abrir Turno de Caja" size="sm">
        <div className={styles.shiftForm}>
          <p className={styles.shiftDesc}>Ingresa el monto de apertura en efectivo para iniciar el turno.</p>
          <Input label="Efectivo de apertura (S/)" id="shift-cash" type="number"
            min={0} step={10} placeholder="0.00"
            value={initialCash} onChange={e => setInitialCash(e.target.value)} />
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={() => setShiftOpen(false)}>Cancelar</Button>
            <Button variant="success" onClick={handleOpenShift} icon={<Clock size={15} />}>
              Abrir turno
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Resumen de cierre ─────────────── */}
      <Modal isOpen={shiftModal} onClose={() => setShiftModal(false)} title="Turno Cerrado — Resumen" size="md">
        {closePreview && (
          <div className={styles.shiftSummary}>
            <div className={styles.summaryTotal}>
              <span>Total cobrado</span>
              <strong>S/ {closePreview.totalAmount?.toFixed(2) || '0.00'}</strong>
            </div>
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}><span>Transacciones</span><strong>{closePreview.totalTx}</strong></div>
              <div className={styles.summaryRow}><span>Cajero</span><strong>{closePreview.cashierName}</strong></div>
              <div className={styles.summaryRow}><span>Efectivo apertura</span><strong>S/ {closePreview.initialCash?.toFixed(2) || '0.00'}</strong></div>
            </div>
            {PAYMENT_METHODS.map(m => (
              <div key={m.id} className={styles.summaryRow}>
                <span>{m.icon} {m.label}</span>
                <strong>S/ {(closePreview.byMethod?.[m.id] || 0).toFixed(2)}</strong>
              </div>
            ))}
            <Button fullWidth variant="ghost" icon={<Printer size={15} />} onClick={() => window.print()}>
              Imprimir resumen
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

/**
 * src/features/reservations/ReservationForm.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Formulario de creación / edición de reservas.
 *
 * Flujo al CREAR:
 *   Paso 1 → DNI del cliente (identificación)
 *   Paso 2 → Datos del cliente + datos de reserva
 *   Paso 3 → Selección de platos (drawer lateral, obligatorio)
 *
 * Flujo al EDITAR:
 *   Formulario completo directo (sin paso de DNI ni drawer de platos,
 *   ya que los platos los gestiona el mozo desde la tarjeta de reserva).
 *
 * Regla de negocio: el cliente paga el 50% del total del pedido
 * como señal al confirmar la reserva (calcDeposit).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { Search, UserPlus, User, ShoppingBag, X, Plus, Minus, ChevronRight, AlertCircle } from 'lucide-react'
import { useClients } from '../../context/ClientContext'
import { useReservations } from '../../context/ReservationContext'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { MENU_ITEMS } from '../../domain/kitchen/menu'
import { calcDeposit } from '../../domain/reservations/reservationRules'
import toast from 'react-hot-toast'
import styles from './ReservationForm.module.css'


const TIME_SLOTS = [
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30',
  '20:00','20:30','21:00','21:30','22:00',
]

const today = new Date().toISOString().split('T')[0]

const EMPTY_FORM = {
  clientId:    '',
  clientName:  '',
  clientPhone: '',
  clientEmail: '',
  clientDni:   '',
  date:        today,
  time:        '13:00',
  guests:      2,
  tableId:     '',
  occasion:    '',
  notes:       '',
  items:       [],
}

// ── Sub-componente: Drawer lateral de selección de platos ──────────────────────
function MenuDrawer({ isOpen, items, onClose, onAddItem, onUpdateQty, onRemoveItem }) {
  const [activeCategory, setActiveCategory] = useState('Todas')
  const [menuQuery,      setMenuQuery]      = useState('')

  const categories   = [...new Set(MENU_ITEMS.map(m => m.category))]
  const orderTotal   = items.reduce((s, i) => s + i.price * i.qty, 0)
  const depositAmount = calcDeposit(orderTotal)

  const filteredMenuItems = MENU_ITEMS.filter(m =>
    (activeCategory === 'Todas' || m.category === activeCategory) &&
    (!menuQuery || m.name.toLowerCase().includes(menuQuery.toLowerCase()))
  )

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className={styles.drawerOverlay} onClick={onClose} />
      )}

      {/* Drawer */}
      <div className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}>
        {/* Header */}
        <div className={styles.drawerHeader}>
          <div>
            <h3 className={styles.drawerTitle}>
              <ShoppingBag size={18} /> Armar pedido de reserva
            </h3>
            <p className={styles.drawerSubtitle}>
              El cliente pagará el 50% como señal al confirmar
            </p>
          </div>
          <button className={styles.drawerClose} onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          {/* Menú izquierda */}
          <div className={styles.drawerMenu}>
            {/* Búsqueda y categoría */}
            <div className={styles.drawerFilters}>
              <div className={styles.drawerSearchWrap}>
                <Search size={14} className={styles.drawerSearchIcon} />
                <input
                  className={styles.drawerSearchInput}
                  placeholder="Buscar plato..."
                  value={menuQuery}
                  onChange={e => setMenuQuery(e.target.value)}
                />
              </div>
              <div className={styles.drawerCatTabs}>
                <button
                  type="button"
                  className={`${styles.drawerCatTab} ${activeCategory === 'Todas' ? styles.drawerCatTabActive : ''}`}
                  onClick={() => setActiveCategory('Todas')}
                >
                  Todas
                </button>
                {categories.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.drawerCatTab} ${activeCategory === c ? styles.drawerCatTabActive : ''}`}
                    onClick={() => setActiveCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de platos */}
            <div className={styles.drawerItemList}>
              {filteredMenuItems.length === 0 ? (
                <p className={styles.drawerEmpty}>Sin resultados para "{menuQuery}"</p>
              ) : filteredMenuItems.map(item => {
                const inOrder = items.find(i => i.menuId === item.id)
                return (
                  <div key={item.id} className={`${styles.drawerItem} ${inOrder ? styles.drawerItemInOrder : ''}`}>
                    <div className={styles.drawerItemInfo}>
                      <span className={styles.drawerItemName}>{item.name}</span>
                      <span className={styles.drawerItemCat}>{item.category}</span>
                    </div>
                    <span className={styles.drawerItemPrice}>S/ {item.price.toFixed(2)}</span>
                    {inOrder ? (
                      <div className={styles.drawerQtyCtrl}>
                        <button type="button" onClick={() => onUpdateQty(item.id, -1)}><Minus size={12} /></button>
                        <span>{inOrder.qty}</span>
                        <button type="button" onClick={() => onUpdateQty(item.id, +1)}><Plus size={12} /></button>
                      </div>
                    ) : (
                      <button type="button" className={styles.drawerAddBtn} onClick={() => onAddItem(item)}>
                        <Plus size={14} /> Agregar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Resumen derecha */}
          <div className={styles.drawerSummary}>
            <p className={styles.drawerSummaryTitle}>Resumen del pedido</p>

            {items.length === 0 ? (
              <div className={styles.drawerSummaryEmpty}>
                <ShoppingBag size={32} />
                <p>Agrega platos para armar el pedido</p>
              </div>
            ) : (
              <div className={styles.drawerOrderList}>
                {items.map(item => (
                  <div key={item.menuId} className={styles.drawerOrderRow}>
                    <div className={styles.drawerOrderInfo}>
                      <span className={styles.drawerOrderName}>{item.name}</span>
                      <span className={styles.drawerOrderSubtotal}>S/ {(item.price * item.qty).toFixed(2)}</span>
                    </div>
                    <div className={styles.drawerOrderControls}>
                      <button type="button" onClick={() => onUpdateQty(item.menuId, -1)}><Minus size={11}/></button>
                      <span>{item.qty}</span>
                      <button type="button" onClick={() => onUpdateQty(item.menuId, +1)}><Plus size={11}/></button>
                      <button type="button" className={styles.drawerOrderRemove} onClick={() => onRemoveItem(item.menuId)}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Totales */}
            {items.length > 0 && (
              <div className={styles.drawerTotals}>
                <div className={styles.drawerTotalRow}>
                  <span>Total pedido</span>
                  <span className={styles.drawerTotalAmt}>S/ {orderTotal.toFixed(2)}</span>
                </div>
                <div className={styles.drawerDepositRow}>
                  <div>
                    <span className={styles.drawerDepositLabel}>Señal (50%)</span>
                    <p className={styles.drawerDepositHint}>El cliente paga esto al confirmar</p>
                  </div>
                  <span className={styles.drawerDepositAmt}>S/ {depositAmount.toFixed(2)}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              className={styles.drawerDoneBtn}
              onClick={onClose}
              disabled={items.length === 0}
            >
              {items.length === 0
                ? 'Agrega platos para continuar'
                : `Confirmar ${items.length} plato${items.length !== 1 ? 's' : ''} — S/ ${depositAmount.toFixed(2)} de señal`
              }
            </button>
          </div>
        </div>
      </div>
    </>
  )
}


// ── Componente principal ───────────────────────────────────────────────────────
export default function ReservationForm({ initialData, onSubmit, onCancel }) {
  const { findByDni, addClient } = useClients()
  const { tables } = useReservations()

  const isCreating = !initialData

  // ── Estado del paso 1: búsqueda por DNI ─────────────────────────────────────
  const [dniQuery,    setDniQuery]   = useState('')
  const [dniSearched, setDniSearched] = useState(false)
  const [clientFound, setFound]       = useState(false)
  const [dniError,    setDniError]    = useState('')

  // ── Estado del formulario ────────────────────────────────────────────────────
  const [showForm,     setShowForm]   = useState(!isCreating)
  const [form,         setForm]       = useState(initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM)
  const [errors,       setErrors]     = useState({})
  const [isSubmitting, setSubmit]     = useState(false)

  // ── Estado del drawer de platos ──────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)

  const orderTotal    = (form.items || []).reduce((s, i) => s + i.price * i.qty, 0)
  const depositAmount = calcDeposit(orderTotal)
  const availableTables = tables.filter(t => t.capacity >= form.guests)

  // ── Paso 1: búsqueda por DNI ─────────────────────────────────────────────────
  const handleDniSearch = () => {
    const dni = dniQuery.trim()
    if (!dni) { setDniError('Ingresa el DNI para continuar'); return }
    if (dni.length < 7 || dni.length > 9) { setDniError('El DNI debe tener entre 7 y 9 dígitos'); return }
    setDniError('')
    const client = findByDni(dni)
    if (client) {
      setForm(f => ({
        ...f,
        clientId: client.id, clientName: client.name,
        clientPhone: client.phone, clientEmail: client.email || '', clientDni: client.dni,
      }))
      setFound(true)
      toast.success(`Cliente encontrado: ${client.name}`, { duration: 2500 })
    } else {
      setForm(f => ({ ...f, clientId: '', clientDni: dni }))
      setFound(false)
      toast('DNI no registrado. Ingresa los datos del nuevo cliente.', { icon: '📋', duration: 2500 })
    }
    setDniSearched(true)
    setShowForm(true)
  }

  const handleDniKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleDniSearch() } }

  // ── Cambios de campo ─────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: name === 'guests' ? Number(value) : value }))
    if (errors[name]) setErrors(err => ({ ...err, [name]: '' }))
  }

  // ── Operaciones de platos ────────────────────────────────────────────────────
  const addOrderItem = (menuItem) => {
    setForm(prev => {
      const existing = (prev.items || []).find(i => i.menuId === menuItem.id)
      if (existing) {
        return { ...prev, items: prev.items.map(i => i.menuId === menuItem.id ? { ...i, qty: i.qty + 1 } : i) }
      }
      return { ...prev, items: [...(prev.items || []), { menuId: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1 }] }
    })
  }

  const updateQty = (menuId, delta) => {
    setForm(prev => ({
      ...prev,
      items: (prev.items || [])
        .map(i => i.menuId === menuId ? { ...i, qty: i.qty + delta } : i)
        .filter(i => i.qty > 0),
    }))
  }

  const removeOrderItem = (menuId) => {
    setForm(prev => ({ ...prev, items: (prev.items || []).filter(i => i.menuId !== menuId) }))
  }

  // ── Validación ───────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!form.clientName.trim()) e.clientName = 'Nombre del cliente requerido'
    if (!form.clientPhone.trim()) e.clientPhone = 'Teléfono requerido'
    if (!form.date) e.date = 'Fecha requerida'
    if (!form.time) e.time = 'Hora requerida'
    if (!form.guests || form.guests < 1) e.guests = 'Mínimo 1 persona'
    if (!form.tableId) e.tableId = 'Selecciona una mesa'
    if (isCreating && (!form.items || form.items.length === 0)) e.items = 'Debes agregar al menos un plato al pedido'
    return e
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      if (errs.items) {
        toast.error('Agrega al menos un plato al pedido antes de crear la reserva', { duration: 3000 })
        setDrawerOpen(true)
      }
      return
    }

    setSubmit(true)
    await new Promise(r => setTimeout(r, 500))

    let clientId = form.clientId
    if (!clientId) {
      const newClient = addClient({
        name: form.clientName, phone: form.clientPhone,
        email: form.clientEmail, dni: form.clientDni,
      })
      clientId = newClient.id
    }

    onSubmit({ ...form, clientId, items: form.items || [], deposit: depositAmount })
    setSubmit(false)
    toast.success(initialData ? 'Reserva actualizada' : 'Reserva creada correctamente')
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PASO 1 — Identificar cliente por DNI (solo al crear)
  // ════════════════════════════════════════════════════════════════════════════
  if (isCreating && !showForm) {
    return (
      <div className={styles.form}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Identificar cliente</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '16px' }}>
            Ingresa el DNI del cliente para verificar si ya está registrado.
          </p>
          <div className={styles.phoneSearch}>
            <Input
              label="DNI del cliente"
              id="res-dni-search"
              name="dniSearch"
              type="text"
              placeholder="Ej: 45678901"
              value={dniQuery}
              onChange={e => { setDniQuery(e.target.value); setDniError('') }}
              onKeyDown={handleDniKeyDown}
              icon={<Search size={15} />}
              hint="Presiona Enter o el botón para buscar"
              error={dniError}
              maxLength={9}
            />
          </div>
        </div>
        <div className={styles.formActions}>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="button" variant="primary" onClick={handleDniSearch}>
            Buscar cliente <ChevronRight size={15} />
          </Button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PASO 2 — Formulario principal + PASO 3 (drawer de platos)
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <>
      <form onSubmit={handleSubmit} className={styles.form} noValidate>

        {/* ── Sección: Datos del cliente ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Datos del cliente</h3>

          {isCreating && (
            <div className={styles.phoneSearch} style={{ marginBottom: '4px' }}>
              <Input
                label="DNI del cliente"
                id="res-dni"
                name="clientDni"
                type="text"
                value={form.clientDni}
                readOnly
                icon={clientFound ? <User size={15} /> : <UserPlus size={15} />}
                hint={clientFound ? '✓ Cliente registrado encontrado' : 'Nuevo cliente — se registrará al guardar'}
              />
              {clientFound && <span className={styles.clientFoundBadge}>✓ Cliente encontrado</span>}
              {!clientFound && dniSearched && (
                <span className={styles.newClientBadge}>
                  <UserPlus size={12} /> Nuevo cliente — se registrará automáticamente
                </span>
              )}
            </div>
          )}

          <div className={styles.row2}>
            <Input
              label="Nombre completo"
              id="res-name"
              name="clientName"
              placeholder="Nombre del cliente"
              value={form.clientName}
              onChange={handleChange}
              error={errors.clientName}
              required
              disabled={clientFound}
            />
            <Input
              label="Teléfono"
              id="res-phone"
              name="clientPhone"
              type="tel"
              placeholder="Ej: 987654321"
              value={form.clientPhone}
              onChange={handleChange}
              error={errors.clientPhone}
              required
              disabled={clientFound}
            />
          </div>
          <div className={styles.row2}>
            <Input
              label="Correo (opcional)"
              id="res-email"
              name="clientEmail"
              type="email"
              placeholder="email@ejemplo.com"
              value={form.clientEmail}
              onChange={handleChange}
              disabled={clientFound}
            />
          </div>
        </div>

        {/* ── Sección: Datos de la reserva ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Datos de la reserva</h3>

          <div className={styles.row3}>
            <Input
              label="Fecha"
              id="res-date"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              error={errors.date}
              required
              min={today}
            />
            <Select
              label="Hora"
              id="res-time"
              name="time"
              value={form.time}
              onChange={handleChange}
              error={errors.time}
              required
            >
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input
              label="N° personas"
              id="res-guests"
              name="guests"
              type="number"
              min={1}
              max={20}
              value={form.guests}
              onChange={handleChange}
              error={errors.guests}
              required
            />
          </div>

          <div className={styles.row2}>
            <Select
              label="Mesa"
              id="res-table"
              name="tableId"
              value={form.tableId}
              onChange={handleChange}
              error={errors.tableId}
              required
            >
              <option value="">Seleccionar mesa...</option>
              {availableTables.map(t => (
                <option key={t.id} value={t.id}>
                  Mesa {t.number} — {t.zone} (cap. {t.capacity})
                </option>
              ))}
            </Select>
            <Select
              label="Motivo (Opcional)"
              id="res-occasion"
              name="occasion"
              value={form.occasion || ''}
              onChange={handleChange}
            >
              <option value="">Ninguno</option>
              <option value="Cumpleaños">Cumpleaños 🎂</option>
              <option value="Aniversario">Aniversario 🥂</option>
              <option value="Negocios">Negocios 💼</option>
              <option value="Cita">Cita ❤️</option>
              <option value="Familiar">Familiar 👨‍👩‍👧</option>
              <option value="Otro">Otro especial...</option>
            </Select>
          </div>

          <Textarea
            label="Notas adicionales"
            id="res-notes"
            name="notes"
            placeholder="Preferencias, alergias, solicitudes especiales..."
            value={form.notes}
            onChange={handleChange}
          />
        </div>

        {/* ── Sección: Botón para abrir el drawer de platos (solo al crear) ── */}
        {isCreating && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Pedido de la reserva</h3>

            <button
              type="button"
              className={`${styles.menuTriggerBtn} ${errors.items ? styles.menuTriggerError : ''} ${form.items?.length > 0 ? styles.menuTriggerFilled : ''}`}
              onClick={() => setDrawerOpen(true)}
            >
              <div className={styles.menuTriggerLeft}>
                <ShoppingBag size={20} className={styles.menuTriggerIcon} />
                <div>
                  {form.items?.length > 0 ? (
                    <>
                      <span className={styles.menuTriggerTitle}>
                        {form.items.length} plato{form.items.length !== 1 ? 's' : ''} seleccionado{form.items.length !== 1 ? 's' : ''}
                      </span>
                      <span className={styles.menuTriggerMeta}>
                        Total: S/ {orderTotal.toFixed(2)} · Señal (50%): <strong>S/ {depositAmount.toFixed(2)}</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={styles.menuTriggerTitle}>Seleccionar platos del pedido</span>
                      <span className={styles.menuTriggerMeta}>
                        El cliente pagará el 50% como señal de reserva
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight size={18} className={styles.menuTriggerArrow} />
            </button>

            {errors.items && (
              <div className={styles.itemsError}>
                <AlertCircle size={14} /> {errors.items}
              </div>
            )}

            {/* Resumen compacto de platos seleccionados */}
            {form.items?.length > 0 && (
              <div className={styles.itemsSummary}>
                {form.items.map(item => (
                  <div key={item.menuId} className={styles.itemsSummaryRow}>
                    <span>{item.qty}× {item.name}</span>
                    <span>S/ {(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
                <div className={styles.itemsSummaryDeposit}>
                  <span>Señal a cobrar (50%)</span>
                  <span>S/ {depositAmount.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Acciones ── */}
        <div className={styles.formActions}>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {initialData ? 'Guardar cambios' : 'Crear reserva'}
          </Button>
        </div>
      </form>

      {/* ── Drawer de selección de platos ── */}
      {isCreating && (
        <MenuDrawer
          isOpen={drawerOpen}
          items={form.items || []}
          onClose={() => setDrawerOpen(false)}
          onAddItem={addOrderItem}
          onUpdateQty={updateQty}
          onRemoveItem={removeOrderItem}
        />
      )}
    </>
  )
}

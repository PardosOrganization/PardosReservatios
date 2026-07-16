/**
 * src/features/reservations/ReservationForm.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Formulario de creación / edición de reservas.
 * Se puede usar dentro de un Modal o de forma independiente.
 *
 * Funcionalidades:
 *   - Busca clientes existentes por teléfono para autocompletar
 *   - Si el cliente no existe, se puede registrar en el momento
 *   - Validación de todos los campos requeridos
 *   - Selección de mesa disponible
 *
 * Props:
 *   - initialData: Object   - Datos preexistentes para edición (opcional)
 *   - onSubmit:    function  - Callback con los datos del formulario
 *   - onCancel:    function  - Callback para cancelar/cerrar
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react'
import { Search, UserPlus, Plus, Minus, Trash2 } from 'lucide-react'
import { useClients } from '../../context/ClientContext'
import { useReservations } from '../../context/ReservationContext'
import { MENU_ITEMS, MENU_CATEGORIES } from '../../domain/kitchen/menu'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'
import styles from './ReservationForm.module.css'

const OCCASIONS = ['', 'Cumpleaños', 'Aniversario', 'Reunión de negocios', 'Cena romántica', 'Familiar', 'Otro']
const TIME_SLOTS = [
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30',
  '20:00','20:30','21:00','21:30','22:00',
]

const today = new Date().toISOString().split('T')[0]

const EMPTY_FORM = {
  clientId:    '',
  clientName:  '',
  clientDni:   '',
  clientPhone: '',
  clientEmail: '',
  date:        today,
  time:        '13:00',
  guests:      2,
  tableId:     '',
  occasion:    '',
  notes:       '',
}

export default function ReservationForm({ initialData, onSubmit, onCancel }) {
  const { findByDni, addClient } = useClients()
  const { tables } = useReservations()

  const [form,         setForm]      = useState(initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM)
  const [errors,       setErrors]    = useState({})
  const [dniQuery,     setDni]       = useState(initialData?.clientDni || '')
  const [clientFound,  setFound]     = useState(!!initialData?.clientId)
  const [isSubmitting, setSubmit]    = useState(false)
  const [preOrder,     setPreOrder]  = useState(initialData?.preOrder || [])
  const [menuSearch,   setMenuSearch]   = useState('')
  const [menuCategory, setMenuCategory] = useState('')

  // Buscar cliente al escribir el DNI (identificador único)
  useEffect(() => {
    if (dniQuery.length >= 8) {
      const client = findByDni(dniQuery)
      if (client) {
        setForm(f => ({
          ...f,
          clientId:    client.id,
          clientName:  client.name,
          clientDni:   client.dni,
          clientPhone: client.phone || '',
          clientEmail: client.email || '',
        }))
        setFound(true)
        toast.success(`Cliente encontrado: ${client.name}`, { duration: 2000 })
      } else {
        setFound(false)
        setForm(f => ({ ...f, clientId: '', clientDni: dniQuery }))
      }
    } else {
      setFound(false)
      setForm(f => ({ ...f, clientId: '', clientDni: dniQuery }))
    }
  }, [dniQuery, findByDni])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: name === 'guests' ? Number(value) : value }))
    if (errors[name]) setErrors(e => ({ ...e, [name]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.clientDni.trim()) e.clientDni = 'DNI requerido'
    else if (!/^\d{8}$/.test(form.clientDni.trim())) e.clientDni = 'El DNI debe tener 8 dígitos'
    if (!form.clientName.trim()) e.clientName = 'Nombre del cliente requerido'
    if (!form.clientPhone.trim()) e.clientPhone = 'Teléfono requerido'
    if (!form.date) e.date = 'Fecha requerida'
    if (!form.time) e.time = 'Hora requerida'
    if (!form.guests || form.guests < 1) e.guests = 'Mínimo 1 persona'
    if (!form.tableId) e.tableId = 'Selecciona una mesa'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmit(true)
    await new Promise(r => setTimeout(r, 500))

    // Si es cliente nuevo y no tiene ID, registrarlo automáticamente
    let clientId = form.clientId
    if (!clientId) {
      const newClient = addClient({
        name:  form.clientName,
        dni:   form.clientDni,
        phone: form.clientPhone,
        email: form.clientEmail,
      })
      clientId = newClient.id
      toast.success('Nuevo cliente registrado automáticamente')
    }

    onSubmit({ ...form, clientId, preOrder })
    setSubmit(false)
    toast.success(initialData ? 'Reserva actualizada' : 'Reserva creada correctamente')
  }

  // ── Pre-pedido: agregar/quitar platos de la carta ──────────────────────────
  const addDish = (item) => {
    setPreOrder(prev => {
      const existing = prev.find(p => p.id === item.id)
      if (existing) {
        return prev.map(p => p.id === item.id ? { ...p, qty: p.qty + 1 } : p)
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }]
    })
  }

  const changeQty = (id, delta) => {
    setPreOrder(prev =>
      prev
        .map(p => p.id === id ? { ...p, qty: p.qty + delta } : p)
        .filter(p => p.qty > 0)
    )
  }

  const removeDish = (id) => setPreOrder(prev => prev.filter(p => p.id !== id))

  const preOrderTotal = preOrder.reduce((sum, p) => sum + p.price * p.qty, 0)

  const filteredMenu = MENU_ITEMS.filter(m =>
    (!menuCategory || m.category === menuCategory) &&
    (!menuSearch || m.name.toLowerCase().includes(menuSearch.toLowerCase()))
  )
  const visibleCategories = [...new Set(filteredMenu.map(m => m.category))]

  // Mesas disponibles según capacidad seleccionada
  const availableTables = tables.filter(t => t.capacity >= form.guests)

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      {/* Buscar cliente por teléfono */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Datos del cliente</h3>

        <div className={styles.phoneSearch}>
          <Input
            label="DNI del cliente"
            id="res-dni"
            name="clientDni"
            inputMode="numeric"
            maxLength={8}
            placeholder="Ej: 45678901"
            value={dniQuery}
            onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
            icon={<Search size={15} />}
            hint="Ingresa el DNI para buscar cliente existente"
            required
            error={errors.clientDni}
          />
          {clientFound && (
            <span className={styles.clientFoundBadge}>✓ Cliente encontrado</span>
          )}
          {dniQuery.length >= 8 && !clientFound && (
            <span className={styles.newClientBadge}>
              <UserPlus size={12} /> Nuevo cliente — se registrará automáticamente
            </span>
          )}
        </div>

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

      {/* Datos de la reserva */}
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
            {TIME_SLOTS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
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
            label="Ocasión especial"
            id="res-occasion"
            name="occasion"
            value={form.occasion}
            onChange={handleChange}
          >
            {OCCASIONS.map(o => (
              <option key={o} value={o}>{o || '— Sin ocasión —'}</option>
            ))}
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

      {/* Pre-pedido de platos de la carta */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Añadir platos al pedido (opcional)</h3>

        <div className={styles.menuPicker}>
          <div className={styles.menuList}>
            <div className={styles.menuFilters}>
              <Input
                id="res-menu-search"
                name="menuSearch"
                placeholder="Buscar plato..."
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
                icon={<Search size={15} />}
              />
              <Select
                id="res-menu-category"
                name="menuCategory"
                value={menuCategory}
                onChange={e => setMenuCategory(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {MENU_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div className={styles.menuItems}>
              {visibleCategories.map(cat => (
                <div key={cat}>
                  <div className={styles.menuCategoryTitle}>{cat}</div>
                  {filteredMenu.filter(m => m.category === cat).map(item => (
                    <div key={item.id} className={styles.menuItem}>
                      <div className={styles.menuItemInfo}>
                        <span className={styles.menuItemName}>{item.name}</span>
                        <span className={styles.menuItemPrice}>S/ {item.price.toFixed(2)}</span>
                      </div>
                      <button
                        type="button"
                        className={styles.menuAddBtn}
                        onClick={() => addDish(item)}
                      >
                        <Plus size={13} /> Agregar
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              {filteredMenu.length === 0 && (
                <p className={styles.menuEmpty}>No se encontraron platos.</p>
              )}
            </div>
          </div>

          <div className={styles.preOrderPanel}>
            <h4 className={styles.preOrderTitle}>Pre-pedido de reserva</h4>
            {preOrder.length === 0 ? (
              <p className={styles.preOrderEmpty}>Agrega platos del menú para armar el pedido</p>
            ) : (
              <>
                <div className={styles.preOrderItems}>
                  {preOrder.map(p => (
                    <div key={p.id} className={styles.preOrderItem}>
                      <div className={styles.preOrderItemInfo}>
                        <span className={styles.preOrderItemName}>{p.name}</span>
                        <span className={styles.preOrderItemPrice}>
                          S/ {(p.price * p.qty).toFixed(2)}
                        </span>
                      </div>
                      <div className={styles.preOrderItemControls}>
                        <button type="button" className={styles.qtyBtn} onClick={() => changeQty(p.id, -1)} aria-label="Quitar uno">
                          <Minus size={12} />
                        </button>
                        <span className={styles.qtyValue}>{p.qty}</span>
                        <button type="button" className={styles.qtyBtn} onClick={() => changeQty(p.id, 1)} aria-label="Agregar uno">
                          <Plus size={12} />
                        </button>
                        <button type="button" className={styles.removeBtn} onClick={() => removeDish(p.id)} aria-label="Eliminar plato">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.preOrderTotal}>
                  <span>Total pre-pedido</span>
                  <strong>S/ {preOrderTotal.toFixed(2)}</strong>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Botones */}
      <div className={styles.formActions}>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {initialData ? 'Guardar cambios' : 'Crear reserva'}
        </Button>
      </div>
    </form>
  )
}

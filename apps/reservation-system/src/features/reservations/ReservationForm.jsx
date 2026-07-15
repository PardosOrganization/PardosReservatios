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
import { Search, UserPlus } from 'lucide-react'
import { useClients } from '../../context/ClientContext'
import { useReservations } from '../../context/ReservationContext'
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
  const { findByPhone, addClient } = useClients()
  const { tables } = useReservations()

  const [form,         setForm]      = useState(initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM)
  const [errors,       setErrors]    = useState({})
  const [phoneQuery,   setPhone]     = useState(initialData?.clientPhone || '')
  const [clientFound,  setFound]     = useState(!!initialData?.clientId)
  const [isSubmitting, setSubmit]    = useState(false)

  // Buscar cliente al escribir teléfono
  useEffect(() => {
    if (phoneQuery.length >= 9) {
      const client = findByPhone(phoneQuery)
      if (client) {
        setForm(f => ({
          ...f,
          clientId:    client.id,
          clientName:  client.name,
          clientPhone: client.phone,
          clientEmail: client.email || '',
        }))
        setFound(true)
        toast.success(`Cliente encontrado: ${client.name}`, { duration: 2000 })
      } else {
        setFound(false)
        setForm(f => ({ ...f, clientId: '', clientPhone: phoneQuery }))
      }
    }
  }, [phoneQuery, findByPhone])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: name === 'guests' ? Number(value) : value }))
    if (errors[name]) setErrors(e => ({ ...e, [name]: '' }))
  }

  const validate = () => {
    const e = {}
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
        phone: form.clientPhone,
        email: form.clientEmail,
      })
      clientId = newClient.id
      toast.success('Nuevo cliente registrado automáticamente')
    }

    onSubmit({ ...form, clientId })
    setSubmit(false)
    toast.success(initialData ? 'Reserva actualizada' : 'Reserva creada correctamente')
  }

  // Mesas disponibles según capacidad seleccionada
  const availableTables = tables.filter(t => t.capacity >= form.guests)

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      {/* Buscar cliente por teléfono */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Datos del cliente</h3>

        <div className={styles.phoneSearch}>
          <Input
            label="Teléfono del cliente"
            id="res-phone"
            name="clientPhone"
            type="tel"
            placeholder="Ej: 987654321"
            value={phoneQuery}
            onChange={e => setPhone(e.target.value)}
            icon={<Search size={15} />}
            hint="Ingresa el teléfono para buscar cliente existente"
            required
            error={errors.clientPhone}
          />
          {clientFound && (
            <span className={styles.clientFoundBadge}>✓ Cliente encontrado</span>
          )}
          {phoneQuery.length >= 9 && !clientFound && (
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

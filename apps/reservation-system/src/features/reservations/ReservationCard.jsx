/**
 * src/features/reservations/ReservationCard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tarjeta individual de una reserva.
 * Muestra la información de la reserva y acciones disponibles según estado:
 *   - Sentar cliente (pending → seated)
 *   - Completar (seated → completed)
 *   - Cancelar con motivo
 *   - Editar datos
 *
 * Props:
 *   - reservation: Object   - Datos de la reserva
 *   - onEdit:      function  - Callback de edición (null = oculta botón)
 *   - onSeat:      function  - Sentar al cliente
 *   - onComplete:  function  - Marcar como completada
 *   - onCancel:    function  - Cancelar con (reason) como argumento
 *   - canCancel:   boolean   - Permiso para cancelar
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { Edit2, CheckCircle, UserCheck, XCircle, Clock, Users, MapPin, Phone, Star } from 'lucide-react'
import { RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS } from '../../context/ReservationContext'
import { Button } from '../../components/ui/Button'
import styles from './ReservationCard.module.css'

const BADGE_CLASS = {
  warning: 'badge badge--warning',
  info:    'badge badge--info',
  success: 'badge badge--success',
  error:   'badge badge--error',
  neutral: 'badge badge--neutral',
}

export default function ReservationCard({ reservation: r, onEdit, onSeat, onComplete, onCancel, canCancel }) {
  const [showCancelInput, setShowCancelInput] = useState(false)
  const [cancelReason, setCancelReason]       = useState('')

  const handleCancel = () => {
    onCancel(cancelReason)
    setShowCancelInput(false)
    setCancelReason('')
  }

  const isActive   = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.SEATED].includes(r.status)
  const isPending  = r.status === RESERVATION_STATUS.PENDING
  const isSeated   = r.status === RESERVATION_STATUS.SEATED
  const statusCls  = BADGE_CLASS[STATUS_COLORS[r.status]] || 'badge'

  return (
    <article className={`${styles.card} ${styles[`card--${r.status}`]}`}>
      {/* Top strip de color */}
      <div className={`${styles.strip} ${styles[`strip--${r.status}`]}`} />

      <div className={styles.body}>
        {/* Header de la tarjeta */}
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.clientName}>{r.clientName}</h3>
            {r.occasion && (
              <span className={styles.occasion}>
                <Star size={11} /> {r.occasion}
              </span>
            )}
          </div>
          <span className={statusCls}>{STATUS_LABELS[r.status]}</span>
        </div>

        {/* Info */}
        <div className={styles.info}>
          <div className={styles.infoItem}>
            <Clock size={14} />
            <span>{r.time} — {r.date}</span>
          </div>
          <div className={styles.infoItem}>
            <Users size={14} />
            <span>{r.guests} persona{r.guests !== 1 ? 's' : ''}</span>
          </div>
          <div className={styles.infoItem}>
            <MapPin size={14} />
            <span>Mesa {r.tableId}</span>
          </div>
          {r.clientPhone && (
            <div className={styles.infoItem}>
              <Phone size={14} />
              <span>{r.clientPhone}</span>
            </div>
          )}
        </div>

        {/* Notas */}
        {r.notes && (
          <p className={styles.notes}>{r.notes}</p>
        )}

        {/* ID */}
        <div className={styles.reservationId}>#{r.id}</div>

        {/* Acciones */}
        {isActive && !showCancelInput && (
          <div className={styles.actions}>
            {isPending && (
              <Button variant="success" size="sm" icon={<UserCheck size={14} />} onClick={onSeat}>
                Sentar
              </Button>
            )}
            {isSeated && (
              <Button variant="primary" size="sm" icon={<CheckCircle size={14} />} onClick={onComplete}>
                Completar
              </Button>
            )}
            {onEdit && (
              <Button variant="ghost" size="sm" icon={<Edit2 size={14} />} onClick={onEdit}>
                Editar
              </Button>
            )}
            {canCancel && (
              <Button variant="ghost" size="sm" icon={<XCircle size={14} />} onClick={() => setShowCancelInput(true)}>
                Cancelar
              </Button>
            )}
          </div>
        )}

        {/* Input de cancelación */}
        {showCancelInput && (
          <div className={styles.cancelBox}>
            <input
              type="text"
              placeholder="Motivo de cancelación (opcional)"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className={styles.cancelInput}
              autoFocus
            />
            <div className={styles.cancelActions}>
              <Button variant="danger" size="sm" onClick={handleCancel}>
                Confirmar cancelación
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowCancelInput(false)}>
                Atrás
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

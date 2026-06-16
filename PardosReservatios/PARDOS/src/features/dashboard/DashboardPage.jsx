/**
 * src/features/dashboard/DashboardPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página principal del dashboard.
 * Muestra un resumen del día con estadísticas clave:
 *   - Total de reservas del día
 *   - Reservas pendientes / en mesa
 *   - Clientes registrados
 *   - Próximas reservas (lista rápida)
 *
 * Acceso: Administrador, Cajero, Hostess
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { CalendarCheck, Users, Clock, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react'
import { useReservations, RESERVATION_STATUS, STATUS_LABELS, STATUS_COLORS } from '../../context/ReservationContext'
import { useClients } from '../../context/ClientContext'
import { useAuth } from '../../context/AuthContext'
import { StatCard, Card } from '../../components/ui/Card'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import styles from './DashboardPage.module.css'

// Mapeo de color de badge a variable CSS
const BADGE_CLASS = {
  warning:  'badge badge--warning',
  info:     'badge badge--info',
  success:  'badge badge--success',
  error:    'badge badge--error',
  neutral:  'badge badge--neutral',
}

export default function DashboardPage() {
  const { todayReservations, reservations } = useReservations()
  const { clients } = useClients()
  const { user } = useAuth()

  const pending   = todayReservations.filter(r => r.status === RESERVATION_STATUS.PENDING)
  const seated    = todayReservations.filter(r => r.status === RESERVATION_STATUS.SEATED)
  const completed = todayReservations.filter(r => r.status === RESERVATION_STATUS.COMPLETED)

  // Próximas reservas (ordenadas por hora)
  const upcoming = [...pending, ...seated].sort((a, b) => a.time.localeCompare(b.time)).slice(0, 6)

  return (
    <div className={styles.page}>
      {/* Encabezado */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })} · Sucursal {user?.sucursal}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Reservas hoy"
          value={todayReservations.length}
          icon={<CalendarCheck size={22} />}
          color="primary"
        />
        <StatCard
          label="Pendientes"
          value={pending.length}
          icon={<Clock size={22} />}
          color="warning"
        />
        <StatCard
          label="En mesa"
          value={seated.length}
          icon={<TrendingUp size={22} />}
          color="info"
        />
        <StatCard
          label="Completadas hoy"
          value={completed.length}
          icon={<CheckCircle size={22} />}
          color="success"
        />
        <StatCard
          label="Total clientes"
          value={clients.length}
          icon={<Users size={22} />}
          color="primary"
        />
        <StatCard
          label="Clientes VIP"
          value={clients.filter(c => c.vip).length}
          icon={<AlertCircle size={22} />}
          color="warning"
        />
      </div>

      {/* Contenido inferior */}
      <div className={styles.bottomGrid}>
        {/* Próximas reservas */}
        <Card
          title="Reservas del día"
          subtitle={`${upcoming.length} reservas activas`}
          noPadding
        >
          {upcoming.length === 0 ? (
            <div className={styles.emptyState}>
              <CalendarCheck size={40} />
              <p>No hay reservas activas por ahora</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Personas</th>
                  <th>Mesa</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(r => (
                  <tr key={r.id}>
                    <td className={styles.time}>{r.time}</td>
                    <td>
                      <div className={styles.clientName}>{r.clientName}</div>
                      <div className={styles.clientPhone}>{r.clientPhone}</div>
                    </td>
                    <td className={styles.center}>{r.guests} 👥</td>
                    <td className={styles.center}>{r.tableId}</td>
                    <td>
                      <span className={BADGE_CLASS[STATUS_COLORS[r.status]] || 'badge'}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Resumen rápido */}
        <Card title="Resumen de hoy" subtitle="Métricas del día">
          <div className={styles.summaryList}>
            {[
              { label: 'Total reservas', value: todayReservations.length, color: 'var(--color-primary)' },
              { label: 'Pendientes',     value: pending.length,          color: 'var(--color-warning)' },
              { label: 'En mesa',        value: seated.length,           color: 'var(--color-info)' },
              { label: 'Completadas',    value: completed.length,        color: 'var(--color-success)' },
              {
                label: 'Canceladas',
                value: todayReservations.filter(r => r.status === RESERVATION_STATUS.CANCELLED).length,
                color: 'var(--color-primary-dark)',
              },
            ].map(item => (
              <div key={item.label} className={styles.summaryItem}>
                <span className={styles.summaryLabel}>{item.label}</span>
                <div className={styles.summaryBar}>
                  <div
                    className={styles.summaryBarFill}
                    style={{
                      width: `${todayReservations.length > 0 ? (item.value / todayReservations.length) * 100 : 0}%`,
                      background: item.color,
                    }}
                  />
                </div>
                <span className={styles.summaryValue} style={{ color: item.color }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Total histórico */}
          <div className={styles.historicNote}>
            <span>Total histórico de reservas:</span>
            <strong>{reservations.length}</strong>
          </div>
        </Card>
      </div>
    </div>
  )
}

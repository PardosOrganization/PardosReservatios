/**
 * src/features/reports/ReportsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de reportes y métricas del sistema.
 * Muestra estadísticas de rendimiento del restaurante:
 *   - Reservas por mes
 *   - Tasa de ocupación y cancelaciones
 *   - Clientes más frecuentes
 *
 * Acceso: Administrador, Cajero
 * Nota: Los gráficos son representaciones CSS (sin biblioteca externa).
 *       En una versión futura, integrar Chart.js o Recharts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useReservations, RESERVATION_STATUS } from '../../context/ReservationContext'
import { useClients } from '../../context/ClientContext'
import { Card, StatCard } from '../../components/ui/Card'
import { BarChart3, Users, CheckCircle, XCircle, TrendingUp } from 'lucide-react'
import styles from './ReportsPage.module.css'

export default function ReportsPage() {
  const { reservations } = useReservations()
  const { clients }      = useClients()

  const total     = reservations.length
  const completed = reservations.filter(r => r.status === RESERVATION_STATUS.COMPLETED).length
  const cancelled = reservations.filter(r => r.status === RESERVATION_STATUS.CANCELLED).length
  const noShow    = reservations.filter(r => r.status === RESERVATION_STATUS.NO_SHOW).length

  const completionRate  = total > 0 ? Math.round((completed / total) * 100) : 0
  const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0

  // Clientes más frecuentes
  const topClients = [...clients]
    .sort((a, b) => (b.totalVisits || 0) - (a.totalVisits || 0))
    .slice(0, 5)

  // Reservas por ocasión
  const byOccasion = reservations.reduce((acc, r) => {
    const key = r.occasion || 'Sin ocasión'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const maxOccasion = Math.max(...Object.values(byOccasion), 1)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Reportes</h1>
        <p className={styles.subtitle}>Métricas generales del sistema</p>
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <StatCard label="Total reservas" value={total}      icon={<BarChart3 size={22} />} color="primary" />
        <StatCard label="Completadas"    value={completed}  icon={<CheckCircle size={22} />} color="success" />
        <StatCard label="Canceladas"     value={cancelled}  icon={<XCircle size={22} />} color="primary" />
        <StatCard label="Tasa de éxito"  value={`${completionRate}%`}  icon={<TrendingUp size={22} />} color="info" />
        <StatCard label="Total clientes" value={clients.length}        icon={<Users size={22} />} color="warning" />
        <StatCard label="Clientes VIP"   value={clients.filter(c => c.vip).length} icon={<Users size={22} />} color="primary" />
      </div>

      <div className={styles.bottomGrid}>
        {/* Tasa de completitud */}
        <Card title="Distribución de reservas" subtitle="Porcentaje según estado final">
          <div className={styles.rateList}>
            {[
              { label: 'Completadas', value: completed, total, color: 'var(--color-success)' },
              { label: 'Canceladas',  value: cancelled, total, color: 'var(--color-primary)' },
              { label: 'No presentaron', value: noShow, total, color: 'var(--color-text-muted)' },
              {
                label: 'Pendientes/En mesa',
                value: total - completed - cancelled - noShow,
                total,
                color: 'var(--color-warning)',
              },
            ].map(item => (
              <div key={item.label} className={styles.rateItem}>
                <div className={styles.rateHeader}>
                  <span className={styles.rateLabel}>{item.label}</span>
                  <span className={styles.rateValue}>{item.value}</span>
                </div>
                <div className={styles.rateBar}>
                  <div
                    className={styles.rateBarFill}
                    style={{
                      width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%`,
                      background: item.color,
                    }}
                  />
                </div>
                <span className={styles.ratePct}>
                  {item.total > 0 ? Math.round((item.value / item.total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Clientes frecuentes */}
        <Card title="Top clientes" subtitle="Más visitas registradas">
          {topClients.length === 0 ? (
            <p className={styles.noData}>Sin datos de clientes aún</p>
          ) : (
            <div className={styles.clientList}>
              {topClients.map((c, i) => (
                <div key={c.id} className={styles.clientRow}>
                  <span className={styles.rank}>#{i + 1}</span>
                  <div className={styles.clientAvatar}>
                    {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className={styles.clientInfo}>
                    <span className={styles.clientNameRep}>{c.name}</span>
                    <span className={styles.clientVisits}>{c.totalVisits || 0} visitas</span>
                  </div>
                  {c.vip && <span className={styles.vipTag}>VIP</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Por ocasión */}
      <Card title="Reservas por ocasión" subtitle="Distribución según motivo de la reserva">
        <div className={styles.occasionGrid}>
          {Object.entries(byOccasion).map(([occasion, count]) => (
            <div key={occasion} className={styles.occasionItem}>
              <div className={styles.occasionBar}>
                <div
                  className={styles.occasionFill}
                  style={{ height: `${(count / maxOccasion) * 100}%` }}
                />
              </div>
              <span className={styles.occasionCount}>{count}</span>
              <span className={styles.occasionLabel}>{occasion}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

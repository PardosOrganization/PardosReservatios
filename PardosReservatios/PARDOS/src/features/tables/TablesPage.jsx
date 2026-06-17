/**
 * src/features/tables/TablesPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de vista de mesas del restaurante.
 * Muestra el mapa visual de mesas con su estado actual (libre/ocupada/reservada).
 * Permite asignar o desasignar mesas manualmente.
 *
 * Acceso: Administrador, Hostess, Mozo
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useReservations, RESERVATION_STATUS } from '../../context/ReservationContext'
import styles from './TablesPage.module.css'

const ZONE_ORDER = ['Salón Principal', 'Terraza', 'VIP']

export default function TablesPage() {
  const { tables, todayReservations } = useReservations()

  // Determinar estado de cada mesa
  const tableStatus = (tableId) => {
    const seated = todayReservations.find(
      r => r.tableId === tableId && r.status === RESERVATION_STATUS.SEATED
    )
    if (seated) return { status: 'occupied', reservation: seated }

    const reserved = todayReservations.find(
      r => r.tableId === tableId && r.status === RESERVATION_STATUS.PENDING
    )
    if (reserved) return { status: 'reserved', reservation: reserved }

    return { status: 'free', reservation: null }
  }

  const byZone = (zone) => tables.filter(t => t.zone === zone)

  const totalFree     = tables.filter(t => tableStatus(t.id).status === 'free').length
  const totalOccupied = tables.filter(t => tableStatus(t.id).status === 'occupied').length
  const totalReserved = tables.filter(t => tableStatus(t.id).status === 'reserved').length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Mapa de Mesas</h1>
          <p className={styles.subtitle}>Vista en tiempo real — {tables.length} mesas en total</p>
        </div>
      </div>

      {/* Leyenda */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={`${styles.dot} ${styles.dotFree}`} />
          <span>Libre ({totalFree})</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.dot} ${styles.dotReserved}`} />
          <span>Reservada ({totalReserved})</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.dot} ${styles.dotOccupied}`} />
          <span>Ocupada ({totalOccupied})</span>
        </div>
      </div>

      {/* Zonas */}
      {ZONE_ORDER.map(zone => (
        <div key={zone} className={styles.zone}>
          <h2 className={styles.zoneName}>{zone}</h2>
          <div className={styles.tablesGrid}>
            {byZone(zone).map(table => {
              const { status, reservation } = tableStatus(table.id)
              return (
                <div
                  key={table.id}
                  className={`${styles.tableCard} ${styles[`table--${status}`]}`}
                  title={reservation ? `${reservation.clientName} · ${reservation.guests} personas · ${reservation.time}` : `Mesa libre · Cap. ${table.capacity}`}
                >
                  <div className={styles.tableNumber}>Mesa {table.number}</div>
                  <div className={styles.tableCap}>Cap. {table.capacity} 👥</div>
                  {reservation ? (
                    <div className={styles.tableClient}>
                      <div className={styles.tableClientName}>{reservation.clientName.split(' ')[0]}</div>
                      <div className={styles.tableTime}>{reservation.time}</div>
                    </div>
                  ) : (
                    <div className={styles.tableFreeLabel}>Libre</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

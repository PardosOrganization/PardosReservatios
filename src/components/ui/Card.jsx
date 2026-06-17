/**
 * src/components/ui/Card.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente de tarjeta (Card) con soporte para encabezado, cuerpo y acciones.
 * Úsalo como contenedor para secciones, paneles y widgets del sistema.
 *
 * Props:
 *   - title:    string   - Título del card (opcional)
 *   - subtitle: string   - Subtítulo (opcional)
 *   - action:   ReactNode - Elemento de acción en el header (botón, etc.)
 *   - noPadding: boolean - Elimina el padding interior (para tablas, etc.)
 *   - className: string  - Clases adicionales
 * ─────────────────────────────────────────────────────────────────────────────
 */

import styles from './Card.module.css'

export function Card({ title, subtitle, action, noPadding = false, className = '', children }) {
  return (
    <div className={`${styles.card} ${className}`}>
      {(title || action) && (
        <div className={styles.header}>
          <div>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {action && <div className={styles.action}>{action}</div>}
        </div>
      )}
      <div className={`${styles.body} ${noPadding ? styles.noPadding : ''}`}>
        {children}
      </div>
    </div>
  )
}

/**
 * StatCard — Tarjeta de estadística con número grande, label e icono.
 * Usada en el Dashboard para mostrar métricas clave.
 */
export function StatCard({ label, value, icon, color = 'primary', trend, className = '' }) {
  const colorMap = {
    primary: { bg: 'var(--color-primary-soft)',  text: 'var(--color-primary)', border: 'var(--color-primary)' },
    success: { bg: 'var(--color-success-soft)',  text: 'var(--color-success)', border: 'var(--color-success)' },
    warning: { bg: 'var(--color-warning-soft)',  text: 'var(--color-warning)', border: 'var(--color-warning)' },
    info:    { bg: 'var(--color-info-soft)',     text: 'var(--color-info)',    border: 'var(--color-info)' },
  }
  const c = colorMap[color] || colorMap.primary

  return (
    <div
      className={`${styles.statCard} ${className}`}
      style={{ borderLeftColor: c.border }}
    >
      <div className={styles.statIcon} style={{ background: c.bg, color: c.text }}>
        {icon}
      </div>
      <div className={styles.statContent}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
        {trend !== undefined && (
          <span className={styles.statTrend} style={{ color: trend >= 0 ? 'var(--color-success)' : 'var(--color-primary)' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * src/components/ui/Button.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente de botón reutilizable con variantes y tamaños.
 * Soporta estado de carga (spinner) y está completamente accesible (a11y).
 *
 * Props:
 *   - variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
 *   - size:    'sm' | 'md' | 'lg'
 *   - isLoading: boolean - Muestra spinner y desactiva el botón
 *   - icon:    ReactNode - Icono a la izquierda del texto
 *   - fullWidth: boolean - Ocupa el 100% del ancho del contenedor
 * ─────────────────────────────────────────────────────────────────────────────
 */

import styles from './Button.module.css'

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon = null,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      className={[
        styles.btn,
        styles[`btn--${variant}`],
        styles[`btn--${size}`],
        fullWidth ? styles['btn--full'] : '',
        isLoading ? styles['btn--loading'] : '',
        className,
      ].join(' ')}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : icon ? (
        <span className={styles.icon}>{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  )
}

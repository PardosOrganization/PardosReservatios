/**
 * src/components/ui/Input.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente de campo de formulario reutilizable.
 * Incluye label, campo de entrada, mensaje de error y soporte para iconos.
 *
 * Props:
 *   - label:      string   - Etiqueta visible del campo
 *   - error:      string   - Mensaje de error (opcional)
 *   - icon:       ReactNode - Icono a la izquierda (opcional)
 *   - hint:       string   - Texto de ayuda debajo del campo
 *   - required:   boolean  - Marca el campo como requerido
 *   - ...rest:    Resto de props nativas del <input>
 * ─────────────────────────────────────────────────────────────────────────────
 */

import styles from './Input.module.css'

export function Input({
  label,
  error,
  icon,
  hint,
  required = false,
  id,
  className = '',
  ...rest
}) {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className={`${styles.field} ${className}`}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={`${styles.inputWrapper} ${error ? styles.hasError : ''}`}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input
          id={inputId}
          className={`${styles.input} ${icon ? styles.withIcon : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
      </div>
      {error && (
        <p id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * Select — Variante para campos de selección (dropdown).
 */
export function Select({ label, error, required = false, id, children, className = '', ...rest }) {
  const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className={`${styles.field} ${className}`}>
      {label && (
        <label className={styles.label} htmlFor={selectId}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={`${styles.inputWrapper} ${error ? styles.hasError : ''}`}>
        <select id={selectId} className={`${styles.input} ${styles.select}`} {...rest}>
          {children}
        </select>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  )
}

/**
 * Textarea — Variante para campos de texto largo.
 */
export function Textarea({ label, error, required = false, id, className = '', ...rest }) {
  const taId = id || `ta-${label?.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className={`${styles.field} ${className}`}>
      {label && (
        <label className={styles.label} htmlFor={taId}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <textarea
        id={taId}
        className={`${styles.input} ${styles.textarea} ${error ? styles.hasError : ''}`}
        {...rest}
      />
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  )
}

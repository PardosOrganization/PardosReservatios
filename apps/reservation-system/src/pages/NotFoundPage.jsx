/**
 * src/pages/NotFoundPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página 404 — Ruta no encontrada.
 * Se muestra cuando el usuario navega a una URL que no existe.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Link } from 'react-router-dom'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.code}>404</div>
        <h1 className={styles.title}>Página no encontrada</h1>
        <p className={styles.message}>
          Lo sentimos, la página que buscas no existe o fue movida.
        </p>
        <Link to="/dashboard" className={styles.link}>
          ← Volver al inicio
        </Link>
      </div>
    </div>
  )
}

/**
 * src/components/auth/ProtectedRoute.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente de ruta protegida.
 * Verifica si el usuario está autenticado antes de renderizar la ruta.
 * Si no lo está, redirige al login.
 * Si el acceso requiere un rol específico, verifica el permiso indicado.
 *
 * Props:
 *   - requiredPermission: string - Clave de ROLE_PERMISSIONS a verificar (opcional)
 *   - children:           ReactNode - Contenido a renderizar si tiene acceso
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * ProtectedRoute — Protege rutas que requieren autenticación.
 * Úsalo para envolver <Route> en el router.
 */
export function ProtectedRoute({ requiredPermission }) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth()

  // Mientras se restaura la sesión desde localStorage
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'Inter, sans-serif',
        color: '#e8453c',
        gap: '12px',
      }}>
        <div style={{
          width: '28px', height: '28px',
          border: '3px solid #e8453c33',
          borderTop: '3px solid #e8453c',
          borderRadius: '50%',
          animation: 'spin 0.75s linear infinite',
        }} />
        Cargando sistema...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Verificar permiso específico si se especifica
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/no-autorizado" replace />
  }

  return <Outlet />
}

/**
 * PublicOnlyRoute — Solo accesible si NO está autenticado.
 * Redirige al dashboard si ya hay sesión activa.
 */
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

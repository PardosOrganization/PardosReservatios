/**
 * src/context/AuthContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de autenticación.
 * Provee el estado del usuario autenticado, su rol y las funciones de
 * login / logout a toda la aplicación mediante React Context API.
 *
 * Roles disponibles:
 *   - 'admin'         → Acceso completo: reportes, ingresos, configuración y todo
 *   - 'cajero'        → Gestión de reservas, caja/cobros, clientes, turno
 *   - 'mozo'          → Vista de reservas y mesas + notificaciones de cocina
 *   - 'hostess'       → Recepción de clientes y asignación de mesas
 *   - 'jefe_cocina'   → Vista de tickets/pedidos pendientes y estado de cocina
 *
 * El usuario se persiste en localStorage para mantener la sesión al recargar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// Usuarios y permisos: fuente unica de verdad en data/seeds y domain/auth
import { MOCK_USERS } from '../data/seeds/usersSeed'
import { ROLE_PERMISSIONS } from '../domain/auth/permissions'

export { MOCK_USERS, ROLE_PERMISSIONS }


// ── Creación del contexto ─────────────────────────────────────────────────────
const AuthContext = createContext(null)

// ── Provider principal ────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restaurar sesión desde localStorage al montar
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('pardos_user')
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      }
    } catch {
      localStorage.removeItem('pardos_user')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * login — Autentica un usuario con email + contraseña.
   * @param {string} email
   * @param {string} password
   * @returns {{ success: boolean, message: string }}
   */
  const login = useCallback((email, password) => {
    const found = MOCK_USERS.find(
      u => u.email === email.trim().toLowerCase() && u.password === password
    )
    if (!found) {
      return { success: false, message: 'Correo o contraseña incorrectos.' }
    }
    const { password: _pw, ...safeUser } = found
    setUser(safeUser)
    localStorage.setItem('pardos_user', JSON.stringify(safeUser))
    return { success: true, message: `Bienvenido, ${safeUser.name}` }
  }, [])

  /** logout — Cierra la sesión y limpia el storage. */
  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('pardos_user')
  }, [])

  /**
   * hasPermission — Verifica si el usuario actual tiene un permiso específico.
   * @param {string} permission - Clave de ROLE_PERMISSIONS
   * @returns {boolean}
   */
  const hasPermission = useCallback(
    (permission) => {
      if (!user) return false
      return ROLE_PERMISSIONS[user.role]?.[permission] === true
    },
    [user]
  )

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    permissions: user ? ROLE_PERMISSIONS[user.role] : null,
    login,
    logout,
    hasPermission,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── Hook personalizado ────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

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

// ── Usuarios precargados (simulado — reemplazar con API real) ─────────────────
export const MOCK_USERS = [
  {
    id: 'u001',
    name: 'Carlos Mendes',
    email: 'admin@pardos.com',
    password: 'admin123',
    role: 'admin',
    avatar: 'CM',
    sucursal: 'Miraflores',
  },
  {
    id: 'u002',
    name: 'Lucia Torres',
    email: 'cajero@pardos.com',
    password: 'cajero123',
    role: 'cajero',
    avatar: 'LT',
    sucursal: 'Miraflores',
  },
  {
    id: 'u003',
    name: 'Diego Quispe',
    email: 'mozo@pardos.com',
    password: 'mozo123',
    role: 'mozo',
    avatar: 'DQ',
    sucursal: 'Miraflores',
  },
  {
    id: 'u004',
    name: 'Gabriela Vega',
    email: 'hostess@pardos.com',
    password: 'hostess123',
    role: 'hostess',
    avatar: 'GV',
    sucursal: 'Miraflores',
  },
  {
    id: 'u005',
    name: 'Marco Ramos',
    email: 'cocina@pardos.com',
    password: 'cocina123',
    role: 'jefe_cocina',
    avatar: 'MR',
    sucursal: 'Miraflores',
  },
]

// ── Definición de permisos por rol ────────────────────────────────────────────
export const ROLE_PERMISSIONS = {
  admin: {
    label: 'Administrador',
    color: '#e8453c',
    // Acceso general
    canManageUsers: true,
    canManageReservations: true,
    canViewReports: true,
    canManageClients: true,
    canManageTables: true,
    canViewAllReservations: true,
    canCancelAnyReservation: true,
    canConfigureSystem: true,
    // Admin exclusivos
    canViewIncomesChart: true,
    canViewAdminDashboard: true,
    canManageAllUsers: true,
    canExportData: true,
    // Caja
    canViewCash: true,
    canManageCash: true,
    // Cocina
    canViewKitchen: true,
    canManageKitchenOrders: true,
  },
  cajero: {
    label: 'Cajero/a',
    color: '#e67e22',
    canManageUsers: false,
    canManageReservations: true,
    canViewReports: true,
    canManageClients: true,
    canManageTables: false,
    canViewAllReservations: true,
    canCancelAnyReservation: true,
    canConfigureSystem: false,
    canViewIncomesChart: false,
    canViewAdminDashboard: false,
    canManageAllUsers: false,
    canExportData: false,
    // Caja: exclusivo del cajero
    canViewCash: true,
    canManageCash: true,
    canManageKitchenOrders: false,
    canViewKitchen: false,
  },
  hostess: {
    label: 'Anfitriona de Bienvenida',
    color: '#8e44ad',
    canManageUsers: false,
    canManageReservations: true,
    canViewReports: false,
    canManageClients: true,
    canManageTables: true,
    canViewAllReservations: true,
    canCancelAnyReservation: false,
    canConfigureSystem: false,
    canViewIncomesChart: false,
    canViewAdminDashboard: false,
    canManageAllUsers: false,
    canExportData: false,
    canViewCash: false,
    canManageCash: false,
    canManageKitchenOrders: false,
    canViewKitchen: false,
  },
  mozo: {
    label: 'Mozo/a',
    color: '#27ae60',
    canManageUsers: false,
    canManageReservations: false,
    canViewReports: false,
    canManageClients: false,
    canManageTables: false,
    canViewAllReservations: false,
    canCancelAnyReservation: false,
    canConfigureSystem: false,
    canViewIncomesChart: false,
    canViewAdminDashboard: false,
    canManageAllUsers: false,
    canExportData: false,
    canViewCash: false,
    canManageCash: false,
    canManageKitchenOrders: false,
    canViewKitchen: false,
  },
  jefe_cocina: {
    label: 'Jefe de Cocina',
    color: '#e67e22',
    canManageUsers: false,
    canManageReservations: false,
    canViewReports: false,
    canManageClients: false,
    canManageTables: false,
    canViewAllReservations: true,   // puede ver reservas para preparar
    canCancelAnyReservation: false,
    canConfigureSystem: false,
    canViewIncomesChart: false,
    canViewAdminDashboard: false,
    canManageAllUsers: false,
    canExportData: false,
    canViewCash: false,
    canManageCash: false,
    // Cocina: exclusivo del jefe de cocina
    canViewKitchen: true,
    canManageKitchenOrders: true,
  },
}

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

/**
 * src/features/settings/SettingsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de configuración del sistema (solo Administrador).
 * Muestra los usuarios registrados y sus roles.
 * En una versión futura, incluirá:
 *   - Gestión de usuarios y contraseñas
 *   - Configuración de sucursales
 *   - Personalización del sistema
 *
 * Acceso: Solo Administrador
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Settings, User, Shield } from 'lucide-react'
import { MOCK_USERS, ROLE_PERMISSIONS } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import styles from './SettingsPage.module.css'

export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Configuración</h1>
        <p className={styles.subtitle}>Panel de administración del sistema</p>
      </div>

      {/* Usuarios del sistema */}
      <Card title="Usuarios del sistema" subtitle="Cuentas activas y roles asignados">
        <div className={styles.userList}>
          {MOCK_USERS.map(u => {
            const role = ROLE_PERMISSIONS[u.role]
            return (
              <div key={u.id} className={styles.userRow}>
                <div className={styles.userAvatar} style={{ background: role.color + '22', color: role.color }}>
                  {u.avatar}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{u.name}</span>
                  <span className={styles.userEmail}>{u.email}</span>
                </div>
                <span className={styles.roleBadge} style={{ background: role.color + '22', color: role.color }}>
                  <Shield size={12} />
                  {role.label}
                </span>
                <span className={styles.sucursal}>{u.sucursal}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Permisos por rol */}
      <Card title="Permisos por rol" subtitle="Resumen de acceso de cada rol">
        <div className={styles.permTable}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Permiso</th>
                {Object.keys(ROLE_PERMISSIONS).map(role => (
                  <th key={role} style={{ color: ROLE_PERMISSIONS[role].color }}>
                    {ROLE_PERMISSIONS[role].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Gestionar reservas',      'canManageReservations'],
                ['Ver todas las reservas',  'canViewAllReservations'],
                ['Cancelar reservas',       'canCancelAnyReservation'],
                ['Gestionar clientes',      'canManageClients'],
                ['Gestionar mesas',         'canManageTables'],
                ['Ver reportes',            'canViewReports'],
                ['Módulo de Caja',          'canManageCash'],
                ['Panel de Cocina',         'canManageKitchenOrders'],
                ['Ver analíticas/ingresos', 'canViewIncomesChart'],
                ['Gestionar usuarios',      'canManageUsers'],
                ['Exportar datos',          'canExportData'],
                ['Configurar sistema',      'canConfigureSystem'],
              ].map(([label, key]) => (
                <tr key={key}>
                  <td className={styles.permLabel}>{label}</td>
                  {Object.keys(ROLE_PERMISSIONS).map(role => (
                    <td key={role} className={styles.permCell}>
                      {ROLE_PERMISSIONS[role][key] ? (
                        <span className={styles.permYes}>✓</span>
                      ) : (
                        <span className={styles.permNo}>✗</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>


      {/* Info del sistema */}
      <Card title="Información del sistema">
        <div className={styles.sysInfo}>
          <div className={styles.sysRow}>
            <span>Versión</span>
            <strong>1.0.0</strong>
          </div>
          <div className={styles.sysRow}>
            <span>Sucursal activa</span>
            <strong>Miraflores</strong>
          </div>
          <div className={styles.sysRow}>
            <span>Tecnología</span>
            <strong>React + Vite</strong>
          </div>
          <div className={styles.sysRow}>
            <span>Almacenamiento</span>
            <strong>LocalStorage (demo)</strong>
          </div>
        </div>
      </Card>
    </div>
  )
}

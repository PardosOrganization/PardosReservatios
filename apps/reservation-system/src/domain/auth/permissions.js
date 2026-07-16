/**
 * src/domain/auth/permissions.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Matriz de permisos por rol del restaurante.
 *
 * Roles:
 *   - admin       → Administrador del sistema (configuración, usuarios, reportes)
 *   - lider       → Jefe de Salón: todos los permisos de anfitriona + mozo,
 *                   único autorizado a eliminar productos de una orden,
 *                   anular cuentas y aplicar descuentos/cortesías.
 *   - cajero      → Procesa pagos, emite boletas, gestiona turno de caja.
 *                   No modifica órdenes ni aplica descuentos no autorizados.
 *   - hostess     → Anfitriona: reservas, mesas y check-in. Sin pedidos ni cobros.
 *   - mozo        → Abre mesas, toma pedidos, agrega productos y envía comandas.
 *                   No elimina productos ni aplica descuentos.
 *   - jefe_cocina → Solo vista de comandas y cambio de estado de platillos.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ROLE_PERMISSIONS = {
  admin: {
    label: 'Administrador',
    color: '#e8453c',
    // Gestión general / sistema
    canManageUsers: true,
    canConfigureSystem: true,
    canViewIncomesChart: true,
    canViewAdminDashboard: true,
    canManageAllUsers: true,
    canExportData: true,
    canViewReports: true,
    canViewHistory: true,
    // Reservas y clientes
    canManageReservations: true,
    canViewAllReservations: true,
    canCancelAnyReservation: true,
    canDeleteReservations: true,
    canManageClients: true,
    canDeleteClients: true,
    // Mesas
    canManageTables: true,
    canSeatGuests: true,
    // Caja
    canViewCash: true,
    canManageCash: true,
    canProcessPayments: true,
    canApplyDiscounts: true,
    canVoidPayments: true,
    // Cocina / órdenes
    canViewKitchen: true,
    canManageKitchenOrders: true,
    canCreateKitchenOrders: true,
    canAddOrderItems: true,
    canRemoveOrderItems: true,
    canUpdateKitchenStatus: true,
    canRequestBill: true,
    // Menú
    canManageMenu: true,
  },

  lider: {
    label: 'Líder · Jefe de Salón',
    color: '#2c3e88',
    // Gestión general / sistema (igual al administrador)
    canManageUsers: true,
    canConfigureSystem: true,
    canViewIncomesChart: true,
    canViewAdminDashboard: true,
    canManageAllUsers: true,
    canExportData: true,
    canViewReports: true,
    canViewHistory: true,
    // Reservas y clientes
    canManageReservations: true,
    canViewAllReservations: true,
    canCancelAnyReservation: true,
    canDeleteReservations: true,
    canManageClients: true,
    canDeleteClients: true,
    // Mesas
    canManageTables: true,
    canSeatGuests: true,
    // Caja
    canViewCash: true,
    canManageCash: true,
    canProcessPayments: true,
    canApplyDiscounts: true,
    canVoidPayments: true,
    // Cocina / órdenes
    canViewKitchen: true,
    canManageKitchenOrders: true,
    canCreateKitchenOrders: true,
    canAddOrderItems: true,
    canRemoveOrderItems: true,
    canUpdateKitchenStatus: true,
    canRequestBill: true,
    // Menú
    canManageMenu: true,
  },

  cajero: {
    label: 'Cajero/a',
    color: '#e67e22',
    canManageUsers: false,
    canConfigureSystem: false,
    canViewIncomesChart: false,
    canViewAdminDashboard: false,
    canManageAllUsers: false,
    canExportData: false,
    canViewReports: true,
    canViewHistory: true,
    canManageReservations: true,
    canViewAllReservations: true,
    canCancelAnyReservation: true,
    canDeleteReservations: false,
    canManageClients: true,
    canDeleteClients: false,
    canManageTables: false,
    canSeatGuests: false,
    // Caja: procesar pagos, boletas y turno
    canViewCash: true,
    canManageCash: true,
    canProcessPayments: true,
    canApplyDiscounts: false,   // solo descuentos pre-autorizados por el Líder
    canVoidPayments: false,
    // No modifica órdenes
    canViewKitchen: false,
    canManageKitchenOrders: false,
    canCreateKitchenOrders: false,
    canAddOrderItems: false,
    canRemoveOrderItems: false,
    canUpdateKitchenStatus: false,
    canRequestBill: false,
    canManageMenu: false,
  },

  hostess: {
    label: 'Anfitriona de Bienvenida',
    color: '#8e44ad',
    canManageUsers: false,
    canConfigureSystem: false,
    canViewIncomesChart: false,
    canViewAdminDashboard: false,
    canManageAllUsers: false,
    canExportData: false,
    canViewReports: false,
    canViewHistory: false,
    // Reservas: crear, editar, cancelar / no-show (nunca eliminar)
    canManageReservations: true,
    canViewAllReservations: true,
    canCancelAnyReservation: true,
    canDeleteReservations: false,
    canManageClients: true,
    canDeleteClients: false,
    // Mesas y check-in
    canManageTables: true,
    canSeatGuests: true,
    // Sin acceso a cobros ni pedidos
    canViewCash: false,
    canManageCash: false,
    canProcessPayments: false,
    canApplyDiscounts: false,
    canVoidPayments: false,
    canViewKitchen: false,
    canManageKitchenOrders: false,
    canCreateKitchenOrders: false,
    canAddOrderItems: false,
    canRemoveOrderItems: false,
    canUpdateKitchenStatus: false,
    canRequestBill: false,
    canManageMenu: false,
  },

  mozo: {
    label: 'Mozo/a',
    color: '#27ae60',
    canManageUsers: false,
    canConfigureSystem: false,
    canViewIncomesChart: false,
    canViewAdminDashboard: false,
    canManageAllUsers: false,
    canExportData: false,
    canViewReports: false,
    canViewHistory: false,
    canManageReservations: false,
    canViewAllReservations: true,
    canCancelAnyReservation: false,
    canDeleteReservations: false,
    canManageClients: false,
    canDeleteClients: false,
    // Abre mesas
    canManageTables: true,
    canSeatGuests: false,
    // Sin cobros ni descuentos
    canViewCash: false,
    canManageCash: false,
    canProcessPayments: false,
    canApplyDiscounts: false,
    canVoidPayments: false,
    // Pedidos: crear comandas y agregar productos (nunca eliminarlos)
    canViewKitchen: true,
    canManageKitchenOrders: false,
    canCreateKitchenOrders: true,
    canAddOrderItems: true,
    canRemoveOrderItems: false,
    canUpdateKitchenStatus: false,
    canRequestBill: true,
    canManageMenu: false,
  },

  jefe_cocina: {
    label: 'Jefe de Cocina',
    color: '#e67e22',
    canManageUsers: false,
    canConfigureSystem: false,
    canViewIncomesChart: false,
    canViewAdminDashboard: false,
    canManageAllUsers: false,
    canExportData: false,
    canViewReports: false,
    canViewHistory: false,
    // Sin acceso a reservas ni información financiera
    canManageReservations: false,
    canViewAllReservations: false,
    canCancelAnyReservation: false,
    canDeleteReservations: false,
    canManageClients: false,
    canDeleteClients: false,
    canManageTables: false,
    canSeatGuests: false,
    canViewCash: false,
    canManageCash: false,
    canProcessPayments: false,
    canApplyDiscounts: false,
    canVoidPayments: false,
    // Solo vista de comandas y estado de platillos
    canViewKitchen: true,
    canManageKitchenOrders: true,
    canCreateKitchenOrders: false,
    canAddOrderItems: false,
    canRemoveOrderItems: false,
    canUpdateKitchenStatus: true,
    canRequestBill: false,
    canManageMenu: false,
  },
}

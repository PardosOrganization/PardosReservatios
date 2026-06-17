import { RESERVATION_STATUS } from './reservationStatus'
import { format } from 'date-fns'

export const generateReservationId = () => `R${Date.now().toString().slice(-6)}`

export const isHistorical = (reservation) => {
  return [
    RESERVATION_STATUS.COMPLETED,
    RESERVATION_STATUS.CANCELLED,
    RESERVATION_STATUS.NO_SHOW,
    RESERVATION_STATUS.REJECTED
  ].includes(reservation.status)
}

export const isToday = (reservation) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  return reservation.date === todayStr &&
    reservation.status !== RESERVATION_STATUS.CANCELLED &&
    reservation.status !== RESERVATION_STATUS.REJECTED
}

/**
 * Regla de negocio: el cliente debe pagar el 50% del total del pedido
 * como señal al momento de confirmar la reserva.
 * @param {number} orderTotal - Total del pedido en soles
 * @returns {number} Monto mínimo del depósito requerido (50%)
 */
export const DEPOSIT_RATE = 0.5

export const calcDeposit = (orderTotal) => {
  return Math.ceil(orderTotal * DEPOSIT_RATE * 100) / 100
}

/**
 * Verifica si el monto pagado cumple el mínimo de señal (≥ 50% del total).
 * @param {number} amountPaid - Monto que el cliente desea pagar como señal
 * @param {number} orderTotal - Total del pedido en soles
 * @returns {boolean} true si cumple la regla de negocio
 */
export const meetsMinimumDeposit = (amountPaid, orderTotal) => {
  if (orderTotal <= 0) return false
  return amountPaid >= orderTotal * DEPOSIT_RATE
}

/**
 * Calcula el saldo pendiente luego de haberse registrado una señal.
 * @param {number} orderTotal - Total del pedido
 * @param {number} depositPaid - Monto ya pagado como señal
 * @returns {number} Saldo restante (nunca negativo)
 */
export const calcRemainingBalance = (orderTotal, depositPaid) => {
  return Math.max(0, orderTotal - depositPaid)
}

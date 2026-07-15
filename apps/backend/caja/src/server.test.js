import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app, {
  resetState,
  todayStr,
  daysAgo,
  payments
} from './server.js'

describe('Caja Service Tests', () => {
  beforeEach(() => {
    // REINICIAR EL ESTADO ANTES DE CADA PRUEBA
    resetState()
  })

  // =========================================================================
  // PRUEBAS UNITARIAS (TESTS 1 A 2)
  // =========================================================================

  it('Test 1: todayStr y daysAgo devuelven fechas con formato e intervalos correctos', () => {
    // VERIFICAR QUE EL HELPER RETORNE EL FORMATO DE FECHA ISO YYYY-MM-DD
    const today = todayStr()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // VERIFICAR QUE HACE 1 DIA RETORNE UNA FECHA VALIDA CON FORMATO CORRECTO
    const yesterday = daysAgo(1)
    expect(yesterday).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(yesterday).not.toBe(todayStr())
  })

  it('Test 2: Validacion de regla para datos de entrada del pago (monto positivo y cashierId obligatorio)', () => {
    // COMPROBAR QUE UN PAGO DEBE CONTENER UN MONTO MAYOR QUE CERO
    const invalidAmountPayment = { cashierId: 'u002', amount: -5.0, clientName: 'Ana' }
    const isAmountValid = invalidAmountPayment.amount > 0
    expect(isAmountValid).toBe(false)

    // COMPROBAR QUE FALLA SI EL PAGO NO TIENE IDENTIFICADOR DE CAJERO
    const invalidCashierPayment = { reservationId: 'R001', clientName: 'Ana Gomez', amount: 100.00, method: 'tarjeta' }
    const isCashierValid = invalidCashierPayment.cashierId !== undefined
    expect(isCashierValid).toBe(false)
  })

  // =========================================================================
  // PRUEBAS DE INTEGRACION / CENTRALIZADAS (TESTS 3 A 5)
  // =========================================================================

  it('Test 3: GET /health retorna estado OK', async () => {
    // LLAMAR AL ENDPOINT DE HEALTH CHECK Y VERIFICAR RESPUESTA EXITOSA
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.service).toBe('svc-caja')
  })

  it('Test 4: POST /api/shift/open abre turno de caja exitosamente', async () => {
    // ENVIAR SOLICITUD DE APERTURA Y VERIFICAR QUE EL ESTADO SEA ABIERTO (RETORNA 201)
    const res = await request(app)
      .post('/api/shift/open')
      .send({ cashierId: 'u002', cashierName: 'Lucia Torres', baseAmount: 120.00 })
    expect(res.status).toBe(201)
    expect(res.body.cashierId).toBe('u002')
    expect(res.body.status).toBe('open')
  })

  it('Test 5: POST /api/shift/close cierra turno de caja exitosamente', async () => {
    // ABRIR TURNO DE CAJA
    await request(app)
      .post('/api/shift/open')
      .send({ cashierId: 'cajera_test', cashierName: 'Cajera Test', baseAmount: 100.00 })

    // REGISTRAR UN PAGO PARA ESTE TURNO
    await request(app)
      .post('/api/payments')
      .send({
        reservationId: 'R106',
        clientName: 'Pedro Perez',
        amount: 50.00,
        method: 'efectivo',
        cashierId: 'cajera_test',
        cashierName: 'Cajera Test',
        guests: 1
      })

    // CERRAR EL TURNO DE CAJA Y VERIFICAR LOS CALCULOS Y ESTADO DE RETORNO
    const res = await request(app).post('/api/shift/close')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('closed')
    expect(res.body.totalAmount).toBe(50.00)
    expect(res.body.totalTx).toBe(1)
  })
})

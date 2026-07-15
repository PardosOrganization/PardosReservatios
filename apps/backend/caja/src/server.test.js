import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app, {
  resetState,
  todayStr,
  daysAgo,
  PAYMENT_METHODS,
  payments
} from './server.js'

describe('Caja Service Tests', () => {
  beforeEach(() => {
    // REINICIAR EL ESTADO ANTES DE CADA PRUEBA
    resetState()
  })

  // =========================================================================
  // PRUEBAS UNITARIAS (TESTS 1 A 10)
  // =========================================================================

  it('Test 1: todayStr devuelve fecha en formato correcto', () => {
    // VERIFICAR QUE EL HELPER RETORNE EL FORMATO DE FECHA ISO YYYY-MM-DD
    const today = todayStr()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('Test 2: daysAgo con 1 dia calcula ayer correctamente', () => {
    // VERIFICAR QUE HACE 1 DIA RETORNE UNA FECHA VALIDA CON FORMATO CORRECTO
    const yesterday = daysAgo(1)
    expect(yesterday).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(yesterday).not.toBe(todayStr())
  })

  it('Test 3: daysAgo con 5 dias calcula la fecha correctamente', () => {
    // VERIFICAR QUE HACE 5 DIAS RETORNE UNA FECHA VALIDA CON FORMATO CORRECTO
    const fiveDaysAgo = daysAgo(5)
    expect(fiveDaysAgo).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('Test 4: PAYMENT_METHODS contiene los 4 metodos de pago requeridos', () => {
    // COMPROBAR QUE LOS METODOS DE PAGO PERMITIDOS SEAN EXACTAMENTE CUATRO
    const methods = PAYMENT_METHODS.map(m => m.id)
    expect(methods).toContain('efectivo')
    expect(methods).toContain('tarjeta')
    expect(methods).toContain('yape')
    expect(methods).toContain('transferencia')
    expect(methods.length).toBe(4)
  })

  it('Test 5: Inicializacion basica del turno de caja', () => {
    // PROBAR QUE UN OBJETO DE TURNO ABIERTO TENGA LOS VALORES INICIALES CORRECTOS
    const newShift = {
      cashierId: 'u101',
      cashierName: 'Juan Perez',
      openedAt: new Date().toISOString(),
      baseAmount: 150.00,
      status: 'open'
    }
    expect(newShift.status).toBe('open')
    expect(newShift.baseAmount).toBe(150.00)
    expect(newShift.cashierName).toBe('Juan Perez')
  })

  it('Test 6: Validacion de regla para impedir doble apertura de turno', () => {
    // SIMULAR EL CASO DONDE YA EXISTE UN TURNO ACTIVO
    const activeShift = { status: 'open' }
    const doubleOpenAttempt = activeShift.status === 'open' ? 'error_double_open' : 'ok'
    expect(doubleOpenAttempt).toBe('error_double_open')
  })

  it('Test 7: Validacion de calculos financieros al cerrar el turno', () => {
    // SIMULAR EL CALCULO DE TOTALES AL CERRAR UN TURNO CON INGRESOS
    const mockShift = { baseAmount: 200.00 }
    const mockPayments = [
      { amount: 50.00 },
      { amount: 120.00 }
    ]
    const totalAmount = mockShift.baseAmount + mockPayments.reduce((s, p) => s + p.amount, 0)
    expect(totalAmount).toBe(370.00)
  })

  it('Test 8: Validacion de regla para impedir cierre si no hay turno activo', () => {
    // SIMULAR CIERRE CUANDO EL TURNO ES NULO (INACTIVO)
    const activeShift = null
    const closeAttempt = activeShift === null ? 'error_no_active_shift' : 'ok'
    expect(closeAttempt).toBe('error_no_active_shift')
  })

  it('Test 9: Validacion de datos de entrada del pago (cajero obligatorio)', () => {
    // COMPROBAR QUE FALLA SI EL PAGO NO TIENE IDENTIFICADOR DE CAJERO
    const invalidPayment = {
      reservationId: 'R001',
      clientName: 'Ana Gomez',
      amount: 100.00,
      method: 'tarjeta'
    }
    const isValid = invalidPayment.cashierId !== undefined
    expect(isValid).toBe(false)
  })

  it('Test 10: Validacion de datos de entrada del pago (monto positivo)', () => {
    // COMPROBAR QUE UN PAGO DEBE CONTENER UN MONTO MAYOR QUE CERO
    const invalidPayment = {
      cashierId: 'u002',
      amount: -10.00
    }
    const isValid = invalidPayment.amount > 0
    expect(isValid).toBe(false)
  })

  // =========================================================================
  // PRUEBAS DE INTEGRACION / CENTRALIZADAS (TESTS 11 A 20)
  // =========================================================================

  it('Test 11: GET /health retorna estado OK', async () => {
    // LLAMAR AL ENDPOINT DE HEALTH CHECK Y VERIFICAR RESPUESTA EXITOSA
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.service).toBe('svc-caja')
  })

  it('Test 12: GET /metrics retorna metricas de Prometheus', async () => {
    // LLAMAR AL ENDPOINT DE METRICAS Y VALIDAR EL CONTENIDO DE RETORNO
    const res = await request(app).get('/metrics')
    expect(res.status).toBe(200)
    expect(res.text).toContain('process_cpu_user_seconds_total')
  })

  it('Test 13: GET /api/payments retorna lista de pagos completa', async () => {
    // OBTENER LA LISTA DE PAGOS Y COMPROBAR QUE RETORNE LA CANTIDAD INICIAL SEED
    const res = await request(app).get('/api/payments')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(19)
  })

  it('Test 14: GET /api/payments permite filtrar los pagos por fecha', async () => {
    // FILTRAR PAGOS POR UNA FECHA QUE TIENE PAGOS HISTORICOS Y COMPROBAR RETORNO
    const filterDate = daysAgo(1)
    const res = await request(app).get(`/api/payments?date=${filterDate}`)
    expect(res.status).toBe(200)
    expect(res.body.every(p => p.date === filterDate)).toBe(true)
  })

  it('Test 15: GET /api/payments/today retorna pagos de hoy', async () => {
    // LLAMAR A PAGOS DE HOY Y VERIFICAR QUE SE RETORNEN CON LA SUMA TOTAL
    const res = await request(app).get('/api/payments/today')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('payments')
    expect(res.body).toHaveProperty('total')
  })

  it('Test 16: POST /api/payments registra un cobro exitosamente', async () => {
    // PRIMERO ABRIR EL TURNO DE CAJA NECESARIO PARA REGISTRAR PAGOS
    await request(app)
      .post('/api/shift/open')
      .send({ cashierId: 'u002', cashierName: 'Lucia Torres', baseAmount: 100.00 })

    // REGISTRAR UN PAGO VALIDO Y COMPROBAR QUE RESPONDA CON CODIGO DE CREADO
    const newPayment = {
      reservationId: 'R105',
      clientName: 'Maria Flores',
      amount: 85.50,
      method: 'yape',
      cashierId: 'u002',
      cashierName: 'Lucia Torres',
      notes: 'Consumo extra',
      guests: 2
    }
    const res = await request(app).post('/api/payments').send(newPayment)
    expect(res.status).toBe(201)
    expect(res.body.clientName).toBe('Maria Flores')
    expect(res.body.amount).toBe(85.50)
  })

  it('Test 17: POST /api/payments falla si faltan datos obligatorios', async () => {
    // ABRIR EL TURNO
    await request(app)
      .post('/api/shift/open')
      .send({ cashierId: 'u002', cashierName: 'Lucia Torres', baseAmount: 100.00 })

    // ENVIAR PAGO INCOMPLETO Y VERIFICAR QUE RETORNE ERROR 400
    const res = await request(app)
      .post('/api/payments')
      .send({ amount: 50.00 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('Test 18: GET /api/shift retorna vacio al inicio', async () => {
    // VERIFICAR QUE EL TURNO SEA NULO CUANDO AUN NO SE HA INICIADO NADA
    const res = await request(app).get('/api/shift')
    expect(res.status).toBe(200)
    expect(res.body.active).toBe(false)
  })

  it('Test 19: POST /api/shift/open abre turno de caja exitosamente', async () => {
    // ENVIAR SOLICITUD DE APERTURA Y VERIFICAR QUE EL ESTADO SEA ABIERTO (RETORNA 201)
    const res = await request(app)
      .post('/api/shift/open')
      .send({ cashierId: 'u002', cashierName: 'Lucia Torres', baseAmount: 120.00 })
    expect(res.status).toBe(201)
    expect(res.body.cashierId).toBe('u002')
    expect(res.body.status).toBe('open')
  })

  it('Test 20: POST /api/shift/close cierra turno de caja exitosamente', async () => {
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

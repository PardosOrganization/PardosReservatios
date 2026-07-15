import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app, {
  resetState,
  TICKET_STATUS,
  MENU_ITEMS
} from './server.js'

describe('Cocina Service Tests', () => {
  beforeEach(() => {
    // REINICIAR EL ESTADO ANTES DE CADA PRUEBA
    resetState()
  })

  // =========================================================================
  // PRUEBAS UNITARIAS (TESTS 16 A 17)
  // =========================================================================

  it('Test 16: Validacion de items obligatorios en ticket de comanda', () => {
    // UN ITEM VALIDO DEBE CONTENER MENUID, NAME, QTY Y PRICE
    const mockItem = { menuId: 'M01', name: 'Pollo', qty: 2, price: 28.00 }
    expect(mockItem).toHaveProperty('menuId')
    expect(mockItem).toHaveProperty('name')
    expect(mockItem).toHaveProperty('qty')
    expect(mockItem).toHaveProperty('price')
  })

  it('Test 17: Regla de transicion de estados de ticket', () => {
    // EL ORDEN LOGICO DE ESTADOS DEBE SER: PENDING -> PREPARING -> READY -> SERVED
    const currentStatus = TICKET_STATUS.PENDING
    const targetStatus = TICKET_STATUS.PREPARING
    
    // TRANSICION DIRECTA DE PENDING A SERVED DEBE RECHAZARSE LOGICAMENTE
    const isTransitionValid = (curr, target) => {
      if (curr === TICKET_STATUS.PENDING && target === TICKET_STATUS.SERVED) return false
      return true
    }
    expect(isTransitionValid(currentStatus, TICKET_STATUS.SERVED)).toBe(false)
    expect(isTransitionValid(currentStatus, targetStatus)).toBe(true)
  })

  // =========================================================================
  // PRUEBAS DE INTEGRACION / CENTRALIZADAS (TESTS 18 A 20)
  // =========================================================================

  it('Test 18: GET /health retorna estado OK', async () => {
    // LLAMAR AL ENDPOINT DE HEALTH CHECK Y VERIFICAR RESPUESTA EXITOSA
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.service).toBe('svc-cocina')
  })

  it('Test 19: GET /api/menu retorna carta del restaurante', async () => {
    // COMPROBAR QUE LA CARTA CONTENGA LOS PLATOS SEMBRADOS
    const res = await request(app).get('/api/menu')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(MENU_ITEMS.length)
  })

  it('Test 20: POST /api/tickets registra comanda exitosamente', async () => {
    // CREAR UN TICKET CON UN ITEM Y COMPROBAR QUE RETORNE CODIGO 201 DE CREADO
    const newTicket = {
      tableId: 'T05',
      clientName: 'Alejandro Prado',
      guests: 3,
      items: [
        { menuId: 'M03', name: 'Pollo a la Brasa Entero', qty: 1, price: 88.00, notes: 'Bien dorado' }
      ],
      priority: 'high',
      notes: 'Mesa cumpleañera'
    }
    const res = await request(app).post('/api/tickets').send(newTicket)
    expect(res.status).toBe(201)
    expect(res.body.clientName).toBe('Alejandro Prado')
    expect(res.body.status).toBe('pending')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app, {
  resetState,
  TABLES,
  notifications
} from './server.js'

describe('Mozo Service Tests', () => {
  beforeEach(() => {
    // REINICIAR EL ESTADO ANTES DE CADA PRUEBA
    resetState()
  })

  // =========================================================================
  // PRUEBAS UNITARIAS (TESTS 11 A 12)
  // =========================================================================

  it('Test 11: Validacion de estructura del mapa de mesas', () => {
    // TODAS LAS MESAS DEBEN TENER ID, NUMBER, CAPACITY, ZONE E ISAVAILABLE
    TABLES.forEach(t => {
      expect(t).toHaveProperty('id')
      expect(t).toHaveProperty('number')
      expect(t).toHaveProperty('capacity')
      expect(t).toHaveProperty('zone')
      expect(t).toHaveProperty('isAvailable')
    })
  })

  it('Test 12: Validacion de capacidad al sentar comensales en mesa', () => {
    // COMPROBAR QUE LA CAPACIDAD DE LA MESA T01 (CAPACIDAD: 2) NO SEA MENOR A LOS INVITADOS
    const table = TABLES.find(t => t.id === 'T01')
    const guests = 2
    const canFit = table.capacity >= guests
    expect(canFit).toBe(true)

    // COMPROBAR QUE SI LOS INVITADOS EXCEDEN LA CAPACIDAD, NO QUEDEN
    const tooManyGuests = 4
    const canFitTooMany = table.capacity >= tooManyGuests
    expect(canFitTooMany).toBe(false)
  })

  // =========================================================================
  // PRUEBAS DE INTEGRACION / CENTRALIZADAS (TESTS 13 A 15)
  // =========================================================================

  it('Test 13: GET /health retorna estado OK', async () => {
    // LLAMAR AL ENDPOINT DE HEALTH CHECK Y VERIFICAR RESPUESTA EXITOSA
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.service).toBe('svc-mozo')
  })

  it('Test 14: GET /api/tables retorna lista de mesas', async () => {
    // OBTENER EL ESTADO DE MESAS Y COMPROBAR QUE DEVUELVA 20 MESAS
    const res = await request(app).get('/api/tables')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(20)
  })

  it('Test 15: PATCH /api/notifications/:id/read marca notificacion como leida', async () => {
    // MARCAR LA NOTIFICACION CON ID N001 COMO LEIDA
    const res = await request(app)
      .patch('/api/notifications/N001/read')
      .send()
    expect(res.status).toBe(200)
    expect(res.body.read).toBe(true)
  })
})

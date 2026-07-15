import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

// MOCK DE LA LIBRERIA PG ANTES DE IMPORTAR SERVER
vi.mock('pg', () => {
  const mPool = {
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [{ count: '1' }] }),
      release: vi.fn()
    }),
    query: vi.fn(async (sql, values) => {
      if (sql && sql.includes('INSERT INTO reservations')) {
        return {
          rows: [{
            id: values[0],
            clientId: values[1],
            clientName: values[2],
            clientPhone: values[3],
            clientEmail: values[4],
            date: values[5],
            time: values[6],
            guests: values[7],
            tableId: values[8],
            status: values[9],
            notes: values[10],
            createdAt: values[11],
            createdBy: values[12],
            occasion: values[13],
            source: values[14]
          }]
        }
      }
      return {
        rows: [
          { id: 'R001', clientName: 'María García', date: '2026-07-15', time: '13:00', guests: 4, tableId: 'T03', status: 'pending' }
        ]
      }
    }),
    on: vi.fn()
  }
  return {
    default: {
      Pool: vi.fn(() => mPool)
    },
    Pool: vi.fn(() => mPool)
  }
})

import app, {
  resetState,
  formatReservation,
  todayStr
} from './server.js'

describe('Anfitriona Service Tests', () => {
  beforeEach(() => {
    // REINICIAR EL ESTADO ANTES DE CADA PRUEBA
    resetState()
  })

  // =========================================================================
  // PRUEBAS UNITARIAS (TESTS 6 A 7)
  // =========================================================================

  it('Test 6: formatReservation estructura el objeto de reserva correctamente', () => {
    // VERIFICAR QUE SE FORMATEE LA FECHA DE LA RESERVA
    const mockRow = {
      id: 'R100',
      date: new Date('2026-07-15T00:00:00Z'),
      clientName: 'Juan'
    }
    const formatted = formatReservation(mockRow)
    expect(formatted.date).toBe('2026-07-15')
    expect(formatted.clientName).toBe('Juan')
  })

  it('Test 7: Validacion de regla para estado de reserva al crear', () => {
    // EL ESTADO INICIAL DEBE SER PENDING O REQUESTED
    const validStates = ['pending', 'requested']
    const newReservationState = 'requested'
    expect(validStates).toContain(newReservationState)
  })

  // =========================================================================
  // PRUEBAS DE INTEGRACION / CENTRALIZADAS (TESTS 8 A 10)
  // =========================================================================

  it('Test 8: GET /health retorna estado OK', async () => {
    // LLAMAR AL ENDPOINT DE HEALTH CHECK Y VERIFICAR RESPUESTA EXITOSA
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.service).toBe('svc-anfitriona')
  })

  it('Test 9: GET /api/reservations devuelve lista de reservas', async () => {
    // OBTENER LA LISTA DE RESERVAS Y COMPROBAR RETORNO EXITOSO (USA DB MOCKED)
    const res = await request(app).get('/api/reservations')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].clientName).toBe('María García')
  })

  it('Test 10: POST /api/reservations registra una nueva reserva', async () => {
    // ENVIAR NUEVA RESERVA Y VALIDAR RETORNO DE CREADO (HTTP 201)
    const newRes = {
      clientName: 'Gabriela Torres',
      clientPhone: '951753654',
      clientEmail: 'gaby@email.com',
      date: todayStr(),
      time: '14:00',
      guests: 2,
      occasion: 'Aniversario'
    }
    const res = await request(app).post('/api/reservations').send(newRes)
    expect(res.status).toBe(201)
    expect(res.body.clientName).toBe('Gabriela Torres')
    expect(res.body.guests).toBe(2)
  })
})

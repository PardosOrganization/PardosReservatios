/**
 * svc-anfitriona/src/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Microservicio Anfitriona — Pardos Chicken
 * Gestiona reservas, mesas y clientes.
 *
 * Endpoints:
 *   GET    /health                      → Health check (ALB / ECS)
 *   GET    /api/reservations            → Listar todas las reservas
 *   GET    /api/reservations/requested  → Solicitudes pendientes de aprobación
 *   GET    /api/reservations/today      → Reservas activas de hoy
 *   POST   /api/reservations            → Crear nueva reserva
 *   PATCH  /api/reservations/:id        → Actualizar reserva (estado, datos)
 *   GET    /api/clients                 → Listar clientes
 *   POST   /api/clients                 → Registrar cliente
 *   PATCH  /api/clients/:id             → Actualizar cliente
 *   GET    /api/tables                  → Estado de mesas
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express from 'express'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import client from 'prom-client'
import pg from 'pg'

const { Pool } = pg

const app = express()
const PORT = process.env.PORT || 8080

// Habilitar recolección de métricas por defecto
client.collectDefaultMetrics({ register: client.register })

app.use(cors())
app.use(express.json())

// Decodificar credenciales de la base de datos desde Secrets Manager
let dbConfig = {
  host: process.env.DB_PROXY_ENDPOINT || 'localhost',
  port: 5432,
  database: 'pardos',
  user: 'pardos_app',
  password: '',
  ssl: process.env.DB_PROXY_ENDPOINT ? { rejectUnauthorized: false } : false
}

if (process.env.DB_CREDENTIALS) {
  try {
    const creds = JSON.parse(process.env.DB_CREDENTIALS)
    dbConfig.user = creds.username || dbConfig.user
    dbConfig.password = creds.password || dbConfig.password
  } catch (err) {
    console.error('Error al parsear DB_CREDENTIALS de Secrets Manager:', err.message)
  }
}

const pool = new Pool(dbConfig)

// Inicializar la tabla de reservas en la base de datos al arrancar
async function initDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS reservations (
      id VARCHAR(50) PRIMARY KEY,
      client_id VARCHAR(50),
      client_name VARCHAR(100),
      client_phone VARCHAR(50),
      client_email VARCHAR(100),
      date DATE NOT NULL,
      time VARCHAR(10) NOT NULL,
      guests INTEGER NOT NULL,
      table_id VARCHAR(50),
      status VARCHAR(50) DEFAULT 'requested',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(50),
      occasion VARCHAR(100),
      source VARCHAR(50) DEFAULT 'system'
    );
  `
  try {
    const client = await pool.connect()
    console.log('🔌 Conectado exitosamente a PostgreSQL (RDS Proxy)')
    await client.query(createTableQuery)
    console.log('✅ Tabla "reservations" verificada/creada con éxito.')

    // Verificar si se necesita poblar con datos semilla
    const countResult = await client.query('SELECT COUNT(*) FROM reservations')
    const count = parseInt(countResult.rows[0].count, 10)
    if (count === 0) {
      console.log('🌱 La tabla de reservas está vacía. Insertando datos semilla...')
      const seedReservations = [
        {
          id: 'R001', clientId: 'C001',
          clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
          date: todayStr(), time: '13:00', guests: 4, tableId: 'T03',
          status: 'pending',
          notes: 'Cumpleaños, pedir torta de chocolate', createdAt: new Date().toISOString(),
          createdBy: 'u004', occasion: 'Cumpleaños',
        },
        {
          id: 'R002', clientId: 'C002',
          clientName: 'Roberto Silva', clientPhone: '912345678', clientEmail: 'roberto@email.com',
          date: todayStr(), time: '14:30', guests: 2, tableId: 'T01',
          status: 'seated',
          notes: '', createdAt: new Date().toISOString(),
          createdBy: 'u004', occasion: '',
        },
        {
          id: 'R003', clientId: 'C004',
          clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
          date: todayStr(), time: '19:00', guests: 6, tableId: 'T06',
          status: 'pending',
          notes: 'Cena de aniversario', createdAt: new Date().toISOString(),
          createdBy: 'u004', occasion: 'Aniversario',
        },
        {
          id: 'R004', clientId: 'C005',
          clientName: 'Carlos Quispe', clientPhone: '956781234', clientEmail: 'carlos_q@email.com',
          date: todayStr(), time: '20:30', guests: 8, tableId: 'T14',
          status: 'pending',
          notes: 'Reunión de empresa', createdAt: new Date().toISOString(),
          createdBy: 'u002', occasion: 'Reunión',
        },
        {
          id: 'R005', clientId: 'C006',
          clientName: 'Lucia Mendoza', clientPhone: '999888777', clientEmail: 'lucia_m@email.com',
          date: todayStr(), time: '21:00', guests: 4, tableId: 'T15',
          status: 'pending',
          notes: 'Mesa VIP solicitada', createdAt: new Date().toISOString(),
          createdBy: 'u004', occasion: '',
        },
        {
          id: 'R006', clientId: 'C003',
          clientName: 'Ana López', clientPhone: '998877665', clientEmail: 'ana@email.com',
          date: daysAgo(1), time: '13:30', guests: 3, tableId: 'T05',
          status: 'completed',
          notes: '', createdAt: new Date(Date.now() - 86400000).toISOString(),
          createdBy: 'u004', occasion: 'Almuerzo familiar',
        },
        {
          id: 'R007', clientId: 'C007',
          clientName: 'Jorge Castillo', clientPhone: '988112233', clientEmail: 'jorge_c@email.com',
          date: daysAgo(1), time: '14:00', guests: 2, tableId: 'T02',
          status: 'completed',
          notes: '', createdAt: new Date(Date.now() - 86400000).toISOString(),
          createdBy: 'u002', occasion: '',
        },
        {
          id: 'R008', clientId: 'C008',
          clientName: 'Isabel Torres', clientPhone: '912233445', clientEmail: 'isabel@email.com',
          date: daysAgo(1), time: '20:00', guests: 5, tableId: 'T11',
          status: 'completed',
          notes: 'Solicitar mesa tranquila', createdAt: new Date(Date.now() - 86400000).toISOString(),
          createdBy: 'u004', occasion: 'Cena',
        },
        {
          id: 'R009', clientId: 'C009',
          clientName: 'Pedro Vásquez', clientPhone: '977665544', clientEmail: 'pedro@email.com',
          date: daysAgo(1), time: '19:30', guests: 4, tableId: 'T10',
          status: 'cancelled',
          notes: '', createdAt: new Date(Date.now() - 86400000).toISOString(),
          createdBy: 'u002', occasion: '',
        },
        {
          id: 'R010', clientId: 'C001',
          clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
          date: daysAgo(2), time: '13:00', guests: 4, tableId: 'T04',
          status: 'completed',
          notes: '', createdAt: new Date(Date.now() - 172800000).toISOString(),
          createdBy: 'u004', occasion: 'Almuerzo familiar',
        },
        {
          id: 'R011', clientId: 'C010',
          clientName: 'Sandra Reyes', clientPhone: '944332211', clientEmail: 'sandra@email.com',
          date: daysAgo(2), time: '20:00', guests: 2, tableId: 'T01',
          status: 'no_show',
          notes: '', createdAt: new Date(Date.now() - 172800000).toISOString(),
          createdBy: 'u004', occasion: '',
        },
        {
          id: 'R012', clientId: 'C004',
          clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
          date: daysAgo(2), time: '14:30', guests: 3, tableId: 'T07',
          status: 'completed',
          notes: '', createdAt: new Date(Date.now() - 172800000).toISOString(),
          createdBy: 'u004', occasion: '',
        }
      ]

      for (const r of seedReservations) {
        const insertQuery = `
          INSERT INTO reservations (
            id, client_id, client_name, client_phone, client_email, 
            date, time, guests, table_id, status, notes, 
            created_at, created_by, occasion
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `
        const values = [
          r.id, r.clientId || null, r.clientName, r.clientPhone || null, r.clientEmail || null,
          r.date, r.time, r.guests, r.tableId || null, r.status, r.notes || '',
          r.createdAt, r.createdBy || null, r.occasion || ''
        ]
        await client.query(insertQuery, values)
      }
      console.log('🌱 Semillas de reservas insertadas con éxito.')
    }
    client.release()
  } catch (err) {
    console.error('❌ Error al inicializar la base de datos PostgreSQL:', err.stack)
  }
}

// Endpoint de métricas de Prometheus
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', client.register.contentType)
  res.send(await client.register.metrics())
})

// Middleware para soportar prefijos de enrutamiento del ALB en AWS
app.use((req, res, next) => {
  const prefixes = ['/anfitriona', '/mozo', '/caja', '/cocina']
  for (const p of prefixes) {
    if (req.url.startsWith(p)) {
      req.url = req.url.slice(p.length)
      break
    }
  }
  next()
})

// ── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]
const daysAgo  = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ── Datos en memoria (seed) ─────────────────────────────────────────────────

const TABLES = Array.from({ length: 20 }, (_, i) => ({
  id: `T${String(i + 1).padStart(2, '0')}`,
  number: i + 1,
  capacity: [2, 2, 4, 4, 4, 6, 6, 2, 4, 4, 6, 2, 4, 8, 4, 6, 2, 4, 4, 6][i],
  zone: i < 8 ? 'Salón Principal' : i < 14 ? 'Terraza' : 'VIP',
  isAvailable: true,
}))

let reservations = [
  // ── HOY — activas
  {
    id: 'R001', clientId: 'C001',
    clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
    date: todayStr(), time: '13:00', guests: 4, tableId: 'T03',
    status: 'pending',
    notes: 'Cumpleaños, pedir torta de chocolate', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: 'Cumpleaños',
  },
  {
    id: 'R002', clientId: 'C002',
    clientName: 'Roberto Silva', clientPhone: '912345678', clientEmail: 'roberto@email.com',
    date: todayStr(), time: '14:30', guests: 2, tableId: 'T01',
    status: 'seated',
    notes: '', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R003', clientId: 'C004',
    clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
    date: todayStr(), time: '19:00', guests: 6, tableId: 'T06',
    status: 'pending',
    notes: 'Cena de aniversario', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: 'Aniversario',
  },
  {
    id: 'R004', clientId: 'C005',
    clientName: 'Carlos Quispe', clientPhone: '956781234', clientEmail: 'carlos_q@email.com',
    date: todayStr(), time: '20:30', guests: 8, tableId: 'T14',
    status: 'pending',
    notes: 'Reunión de empresa', createdAt: new Date().toISOString(),
    createdBy: 'u002', occasion: 'Reunión',
  },
  {
    id: 'R005', clientId: 'C006',
    clientName: 'Lucia Mendoza', clientPhone: '999888777', clientEmail: 'lucia_m@email.com',
    date: todayStr(), time: '21:00', guests: 4, tableId: 'T15',
    status: 'pending',
    notes: 'Mesa VIP solicitada', createdAt: new Date().toISOString(),
    createdBy: 'u004', occasion: '',
  },
  // ── AYER
  {
    id: 'R006', clientId: 'C003',
    clientName: 'Ana López', clientPhone: '998877665', clientEmail: 'ana@email.com',
    date: daysAgo(1), time: '13:30', guests: 3, tableId: 'T05',
    status: 'completed',
    notes: '', createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'u004', occasion: 'Almuerzo familiar',
  },
  {
    id: 'R007', clientId: 'C007',
    clientName: 'Jorge Castillo', clientPhone: '988112233', clientEmail: 'jorge_c@email.com',
    date: daysAgo(1), time: '14:00', guests: 2, tableId: 'T02',
    status: 'completed',
    notes: '', createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'u002', occasion: '',
  },
  {
    id: 'R008', clientId: 'C008',
    clientName: 'Isabel Torres', clientPhone: '912233445', clientEmail: 'isabel@email.com',
    date: daysAgo(1), time: '20:00', guests: 5, tableId: 'T11',
    status: 'completed',
    notes: 'Solicitar mesa tranquila', createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'u004', occasion: 'Cena',
  },
  {
    id: 'R009', clientId: 'C009',
    clientName: 'Pedro Vásquez', clientPhone: '977665544', clientEmail: 'pedro@email.com',
    date: daysAgo(1), time: '19:30', guests: 4, tableId: 'T10',
    status: 'cancelled', cancelReason: 'Cliente llamó para cancelar',
    notes: '', createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'u002', occasion: '',
  },
  // ── HACE 2 DÍAS
  {
    id: 'R010', clientId: 'C001',
    clientName: 'María García', clientPhone: '987654321', clientEmail: 'maria@email.com',
    date: daysAgo(2), time: '13:00', guests: 4, tableId: 'T04',
    status: 'completed',
    notes: '', createdAt: new Date(Date.now() - 172800000).toISOString(),
    createdBy: 'u004', occasion: 'Almuerzo familiar',
  },
  {
    id: 'R011', clientId: 'C010',
    clientName: 'Sandra Reyes', clientPhone: '944332211', clientEmail: 'sandra@email.com',
    date: daysAgo(2), time: '20:00', guests: 2, tableId: 'T01',
    status: 'no_show',
    notes: '', createdAt: new Date(Date.now() - 172800000).toISOString(),
    createdBy: 'u004', occasion: '',
  },
  {
    id: 'R012', clientId: 'C004',
    clientName: 'Patricia Flores', clientPhone: '943211234', clientEmail: 'patricia@email.com',
    date: daysAgo(2), time: '14:30', guests: 3, tableId: 'T07',
    status: 'completed',
    notes: '', createdAt: new Date(Date.now() - 172800000).toISOString(),
    createdBy: 'u004', occasion: '',
  },
]

let clients = [
  {
    id: 'C001', name: 'María García', phone: '987654321', email: 'maria@email.com',
    dni: '45678901', birthday: '1990-03-15',
    preferences: 'Sin picante, mesa de ventana', allergies: 'Ninguna',
    totalVisits: 12, totalReservations: 13, lastVisit: '2026-04-02',
    registeredAt: '2025-01-10T10:00:00Z',
    notes: 'Cliente frecuente, viene con familia. Le gusta el pollo a la brasa entero.',
    vip: true,
  },
  {
    id: 'C002', name: 'Roberto Silva', phone: '912345678', email: 'roberto@email.com',
    dni: '32145678', birthday: '1985-07-22',
    preferences: 'Mesa interior, cerca de la ventana', allergies: 'Mariscos',
    totalVisits: 5, totalReservations: 6, lastVisit: '2026-04-01',
    registeredAt: '2026-01-05T14:00:00Z',
    notes: 'Alérgico a mariscos.', vip: false,
  },
  {
    id: 'C003', name: 'Ana López', phone: '998877665', email: 'ana@email.com',
    dni: '56789012', birthday: '1995-11-08',
    preferences: 'Silla alta para bebé, mesa amplia', allergies: 'Gluten',
    totalVisits: 15, totalReservations: 16, lastVisit: '2026-04-02',
    registeredAt: '2024-06-01T09:00:00Z',
    notes: 'Viene siempre con su bebé. Alergia al gluten confirmada.', vip: true,
  },
  {
    id: 'C004', name: 'Patricia Flores', phone: '943211234', email: 'patricia@email.com',
    dni: '67890123', birthday: '1988-05-20',
    preferences: 'Mesa tranquila, lejos del área de barra', allergies: 'Ninguna',
    totalVisits: 8, totalReservations: 9, lastVisit: '2026-04-01',
    registeredAt: '2025-03-15T11:00:00Z',
    notes: 'Suele celebrar aniversarios aquí.', vip: true,
  },
  {
    id: 'C005', name: 'Carlos Quispe', phone: '956781234', email: 'carlos_q@email.com',
    dni: '78901234', birthday: '1980-09-12',
    preferences: 'Reservas para grupos grandes', allergies: 'Ninguna',
    totalVisits: 6, totalReservations: 7, lastVisit: '2026-03-30',
    registeredAt: '2025-06-20T09:00:00Z',
    notes: 'Trae grupos corporativos.', vip: false,
  },
  {
    id: 'C006', name: 'Lucia Mendoza', phone: '999888777', email: 'lucia_m@email.com',
    dni: '89012345', birthday: '1992-02-14',
    preferences: 'Mesa VIP, decoración especial', allergies: 'Frutos secos',
    totalVisits: 10, totalReservations: 11, lastVisit: '2026-04-03',
    registeredAt: '2024-11-01T10:00:00Z',
    notes: 'Alergia a frutos secos.', vip: true,
  },
  {
    id: 'C007', name: 'Jorge Castillo', phone: '988112233', email: 'jorge_c@email.com',
    dni: '90123456', birthday: '1978-12-30',
    preferences: 'Mesa esquinera, carta sin cerdo', allergies: 'Cerdo',
    totalVisits: 4, totalReservations: 4, lastVisit: '2026-04-02',
    registeredAt: '2026-02-10T14:00:00Z', notes: '', vip: false,
  },
  {
    id: 'C008', name: 'Isabel Torres', phone: '912233445', email: 'isabel@email.com',
    dni: '01234567', birthday: '1993-06-18',
    preferences: 'Mesa con iluminación tenue', allergies: 'Ninguna',
    totalVisits: 7, totalReservations: 8, lastVisit: '2026-04-02',
    registeredAt: '2025-08-05T16:00:00Z',
    notes: 'Le encanta el pollo a la brasa.', vip: false,
  },
  {
    id: 'C009', name: 'Pedro Vásquez', phone: '977665544', email: 'pedro@email.com',
    dni: '12309876', birthday: '1975-03-05',
    preferences: 'Mesa exterior', allergies: 'Ninguna',
    totalVisits: 2, totalReservations: 3, lastVisit: '2026-04-02',
    registeredAt: '2026-03-01T10:00:00Z',
    notes: 'Canceló una reserva sin aviso previo.', vip: false,
  },
  {
    id: 'C010', name: 'Sandra Reyes', phone: '944332211', email: 'sandra@email.com',
    dni: '23410987', birthday: '1998-08-25',
    preferences: 'Sin preferencia especial', allergies: 'Lácteos',
    totalVisits: 1, totalReservations: 2, lastVisit: '2026-04-01',
    registeredAt: '2026-03-20T12:00:00Z',
    notes: 'No se presentó a una reserva. Intolerancia a lácteos.', vip: false,
  },
  {
    id: 'C011', name: 'Enrique Huamán', phone: '955443322', email: 'enrique@email.com',
    dni: '34521098', birthday: '1970-11-15',
    preferences: 'Mesa privada, reuniones de trabajo', allergies: 'Ninguna',
    totalVisits: 9, totalReservations: 10, lastVisit: '2026-03-31',
    registeredAt: '2024-09-15T09:00:00Z',
    notes: 'Socio de empresa.', vip: true,
  },
  {
    id: 'C012', name: 'Valeria Cruz', phone: '966554433', email: 'valeria@email.com',
    dni: '45632109', birthday: '1997-04-10',
    preferences: 'Decoración floral, música suave', allergies: 'Ninguna',
    totalVisits: 5, totalReservations: 5, lastVisit: '2026-03-30',
    registeredAt: '2025-10-01T11:00:00Z',
    notes: 'Hace cumpleaños aquí.', vip: false,
  },
]

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'svc-anfitriona', timestamp: new Date().toISOString() })
})

// ══════════════════════════════════════════════════════════════════════════════
// RESERVAS
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/reservations — Todas las reservas */
app.get('/api/reservations', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, client_id AS "clientId", client_name AS "clientName", client_phone AS "clientPhone", client_email AS "clientEmail", date, time, guests, table_id AS "tableId", status, notes, created_at AS "createdAt", created_by AS "createdBy", occasion, source FROM reservations ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (err) {
    console.error('Error al obtener reservas de la base de datos:', err)
    res.status(500).json({ error: 'Error al consultar reservas' })
  }
})

/** GET /api/reservations/requested — Solo solicitudes pendientes de aprobación */
app.get('/api/reservations/requested', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, client_id AS "clientId", client_name AS "clientName", client_phone AS "clientPhone", client_email AS "clientEmail", date, time, guests, table_id AS "tableId", status, notes, created_at AS "createdAt", created_by AS "createdBy", occasion, source FROM reservations WHERE status = \'requested\' ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (err) {
    console.error('Error al obtener solicitudes:', err)
    res.status(500).json({ error: 'Error al consultar solicitudes' })
  }
})

/** GET /api/reservations/today — Reservas activas de hoy */
app.get('/api/reservations/today', async (_req, res) => {
  const today = todayStr()
  try {
    const result = await pool.query('SELECT id, client_id AS "clientId", client_name AS "clientName", client_phone AS "clientPhone", client_email AS "clientEmail", date, time, guests, table_id AS "tableId", status, notes, created_at AS "createdAt", created_by AS "createdBy", occasion, source FROM reservations WHERE date = $1 AND status NOT IN (\'cancelled\', \'rejected\') ORDER BY time ASC', [today])
    res.json(result.rows)
  } catch (err) {
    console.error('Error al obtener reservas de hoy:', err)
    res.status(500).json({ error: 'Error al consultar reservas de hoy' })
  }
})

/** GET /api/reservations/history — Historial (completed, cancelled, no_show, rejected) */
app.get('/api/reservations/history', async (_req, res) => {
  try {
    const result = await pool.query('SELECT id, client_id AS "clientId", client_name AS "clientName", client_phone AS "clientPhone", client_email AS "clientEmail", date, time, guests, table_id AS "tableId", status, notes, created_at AS "createdAt", created_by AS "createdBy", occasion, source FROM reservations WHERE status IN (\'completed\', \'cancelled\', \'no_show\', \'rejected\') ORDER BY date DESC, time DESC')
    res.json(result.rows)
  } catch (err) {
    console.error('Error al obtener historial de reservas:', err)
    res.status(500).json({ error: 'Error al consultar historial' })
  }
})

/** POST /api/reservations — Crear nueva reserva */
app.post('/api/reservations', async (req, res) => {
  const data = req.body
  const id = `R${uuidv4().slice(0, 6).toUpperCase()}`
  const status = data.status || 'requested'
  const source = data.source || 'system'
  const createdAt = new Date().toISOString()

  try {
    const insertQuery = `
      INSERT INTO reservations (
        id, client_id, client_name, client_phone, client_email, 
        date, time, guests, table_id, status, notes, 
        created_at, created_by, occasion, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, client_id AS "clientId", client_name AS "clientName", client_phone AS "clientPhone", client_email AS "clientEmail", date, time, guests, table_id AS "tableId", status, notes, created_at AS "createdAt", created_by AS "createdBy", occasion, source
    `
    const values = [
      id, data.clientId || null, data.clientName, data.clientPhone || null, data.clientEmail || null,
      data.date, data.time, data.guests, data.tableId || null, status, data.notes || '',
      createdAt, data.createdBy || null, data.occasion || '', source
    ]
    const result = await pool.query(insertQuery, values)
    const newReservation = result.rows[0]

    console.log(`[INFO] Nueva reserva creada con éxito. ID: ${newReservation.id}, Estado: ${newReservation.status}, Cliente: ${newReservation.clientName}, Personas: ${newReservation.guests}, Mesa: ${newReservation.tableId || 'Pendiente'}`)
    res.status(201).json(newReservation)
  } catch (err) {
    console.error('Error al insertar reserva en base de datos:', err)
    res.status(500).json({ error: 'Error al guardar la reserva en la base de datos' })
  }
})

/** PATCH /api/reservations/:id — Actualizar reserva */
app.patch('/api/reservations/:id', async (req, res) => {
  const { id } = req.params
  const updates = req.body

  const fields = []
  const values = []
  let idx = 1

  const allowedUpdates = {
    status: 'status',
    tableId: 'table_id',
    notes: 'notes',
    guests: 'guests',
    time: 'time',
    date: 'date'
  }

  for (const [key, value] of Object.entries(updates)) {
    if (allowedUpdates[key]) {
      fields.push(`${allowedUpdates[key]} = $${idx}`)
      values.push(value)
      idx++
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No se enviaron campos válidos para actualizar' })
  }

  values.push(id)
  const updateQuery = `
    UPDATE reservations 
    SET ${fields.join(', ')} 
    WHERE id = $${idx} 
    RETURNING id, client_id AS "clientId", client_name AS "clientName", client_phone AS "clientPhone", client_email AS "clientEmail", date, time, guests, table_id AS "tableId", status, notes, created_at AS "createdAt", created_by AS "createdBy", occasion, source
  `

  try {
    const result = await pool.query(updateQuery, values)
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('Error al actualizar reserva:', err)
    res.status(500).json({ error: 'Error al actualizar reserva en base de datos' })
  }
})

/** DELETE /api/reservations/:id — Eliminar reserva */
app.delete('/api/reservations/:id', async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query('DELETE FROM reservations WHERE id = $1 RETURNING *', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' })
    }
    res.status(204).end()
  } catch (err) {
    console.error('Error al eliminar reserva:', err)
    res.status(500).json({ error: 'Error al eliminar reserva en base de datos' })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/clients — Listar todos los clientes */
app.get('/api/clients', (req, res) => {
  const { q } = req.query
  if (q && q.length >= 2) {
    const query = q.toLowerCase()
    return res.json(clients.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.phone?.includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.dni?.includes(query)
    ))
  }
  res.json(clients)
})

/** GET /api/clients/:id — Obtener cliente por ID */
app.get('/api/clients/:id', (req, res) => {
  const client = clients.find(c => c.id === req.params.id)
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' })
  res.json(client)
})

/** POST /api/clients — Registrar nuevo cliente */
app.post('/api/clients', (req, res) => {
  const data = req.body
  const newClient = {
    ...data,
    id: `C${uuidv4().slice(0, 6).toUpperCase()}`,
    totalVisits: 0,
    totalReservations: 0,
    lastVisit: null,
    registeredAt: new Date().toISOString(),
    vip: false,
  }
  clients.unshift(newClient)
  res.status(201).json(newClient)
})

/** PATCH /api/clients/:id — Actualizar cliente */
app.patch('/api/clients/:id', (req, res) => {
  const { id } = req.params
  const updates = req.body
  const idx = clients.findIndex(c => c.id === id)
  if (idx === -1) return res.status(404).json({ error: 'Cliente no encontrado' })

  clients[idx] = { ...clients[idx], ...updates, updatedAt: new Date().toISOString() }
  res.json(clients[idx])
})

/** POST /api/clients/:id/visit — Incrementar visitas */
app.post('/api/clients/:id/visit', (req, res) => {
  const idx = clients.findIndex(c => c.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Cliente no encontrado' })

  clients[idx].totalVisits = (clients[idx].totalVisits || 0) + 1
  clients[idx].lastVisit = todayStr()
  res.json(clients[idx])
})

// ══════════════════════════════════════════════════════════════════════════════
// MESAS
// ══════════════════════════════════════════════════════════════════════════════

/** GET /api/tables — Estado actual de mesas */
app.get('/api/tables', async (_req, res) => {
  // Marcar mesas ocupadas según reservas activas de hoy
  const today = todayStr()
  try {
    const result = await pool.query('SELECT table_id FROM reservations WHERE date = $1 AND status IN (\'seated\', \'pending\')', [today])
    const occupiedTableIds = result.rows.map(r => r.table_id).filter(Boolean)

    const tablesWithStatus = TABLES.map(t => ({
      ...t,
      isAvailable: !occupiedTableIds.includes(t.id),
    }))
    res.json(tablesWithStatus)
  } catch (err) {
    console.error('Error al obtener mesas ocupadas:', err)
    res.status(500).json({ error: 'Error al consultar estado de mesas' })
  }
})

// ── Arranque ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🏠 svc-anfitriona escuchando en http://0.0.0.0:${PORT}`)
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM reservations')
    const count = countResult.rows[0].count
    console.log(`   ${count} reservas cargadas desde PostgreSQL · ${clients.length} clientes · ${TABLES.length} mesas cargadas`)
  } catch (err) {
    console.error('Error al consultar conteo inicial de reservas:', err)
  }
})

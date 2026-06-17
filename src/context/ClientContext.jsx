/**
 * src/context/ClientContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Contexto global de clientes.
 * Centraliza el registro, búsqueda y actualización de clientes del restaurante.
 * Los clientes se "recuerdan" automáticamente para futuras reservas,
 * con su historial de visitas y preferencias.
 *
 * Funciones principales:
 *   - addClient       → Registrar nuevo cliente
 *   - updateClient    → Actualizar datos del cliente
 *   - searchClients   → Buscar por nombre, teléfono o email
 *   - getClientById   → Obtener cliente por ID
 *   - incrementVisits → Incrementar contador de visitas
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ── Clientes de ejemplo ───────────────────────────────────────────────────────
const SAMPLE_CLIENTS = [
  {
    id: 'C001',
    name: 'María García',
    phone: '987654321',
    email: 'maria@email.com',
    dni: '45678901',
    birthday: '1990-03-15',
    preferences: 'Sin picante, mesa de ventana',
    allergies: 'Ninguna',
    totalVisits: 12,
    totalReservations: 13,
    lastVisit: '2026-04-02',
    registeredAt: '2025-01-10T10:00:00Z',
    notes: 'Cliente frecuente, viene con familia. Le gusta el pollo a la brasa entero.',
    vip: true,
  },
  {
    id: 'C002',
    name: 'Roberto Silva',
    phone: '912345678',
    email: 'roberto@email.com',
    dni: '32145678',
    birthday: '1985-07-22',
    preferences: 'Mesa interior, cerca de la ventana',
    allergies: 'Mariscos',
    totalVisits: 5,
    totalReservations: 6,
    lastVisit: '2026-04-01',
    registeredAt: '2026-01-05T14:00:00Z',
    notes: 'Alérgico a mariscos — asegurarse que los utensilios estén limpios.',
    vip: false,
  },
  {
    id: 'C003',
    name: 'Ana López',
    phone: '998877665',
    email: 'ana@email.com',
    dni: '56789012',
    birthday: '1995-11-08',
    preferences: 'Silla alta para bebé, mesa amplia',
    allergies: 'Gluten',
    totalVisits: 15,
    totalReservations: 16,
    lastVisit: '2026-04-02',
    registeredAt: '2024-06-01T09:00:00Z',
    notes: 'Viene siempre con su bebé. Alergia al gluten confirmada.',
    vip: true,
  },
  {
    id: 'C004',
    name: 'Patricia Flores',
    phone: '943211234',
    email: 'patricia@email.com',
    dni: '67890123',
    birthday: '1988-05-20',
    preferences: 'Mesa tranquila, lejos del área de barra',
    allergies: 'Ninguna',
    totalVisits: 8,
    totalReservations: 9,
    lastVisit: '2026-04-01',
    registeredAt: '2025-03-15T11:00:00Z',
    notes: 'Suele celebrar aniversarios aquí.',
    vip: true,
  },
  {
    id: 'C005',
    name: 'Carlos Quispe',
    phone: '956781234',
    email: 'carlos_q@email.com',
    dni: '78901234',
    birthday: '1980-09-12',
    preferences: 'Reservas para grupos grandes, necesita separación de espacios',
    allergies: 'Ninguna',
    totalVisits: 6,
    totalReservations: 7,
    lastVisit: '2026-03-30',
    registeredAt: '2025-06-20T09:00:00Z',
    notes: 'Trae grupos corporativos. Pide siempre el área privada.',
    vip: false,
  },
  {
    id: 'C006',
    name: 'Lucia Mendoza',
    phone: '999888777',
    email: 'lucia_m@email.com',
    dni: '89012345',
    birthday: '1992-02-14',
    preferences: 'Mesa VIP, decoración especial para fechas',
    allergies: 'Frutos secos',
    totalVisits: 10,
    totalReservations: 11,
    lastVisit: '2026-04-03',
    registeredAt: '2024-11-01T10:00:00Z',
    notes: 'Alergia confirmada a frutos secos. Siempre trae flores para decorar.',
    vip: true,
  },
  {
    id: 'C007',
    name: 'Jorge Castillo',
    phone: '988112233',
    email: 'jorge_c@email.com',
    dni: '90123456',
    birthday: '1978-12-30',
    preferences: 'Mesa esquinera, carta sin cerdo',
    allergies: 'Cerdo',
    totalVisits: 4,
    totalReservations: 4,
    lastVisit: '2026-04-02',
    registeredAt: '2026-02-10T14:00:00Z',
    notes: '',
    vip: false,
  },
  {
    id: 'C008',
    name: 'Isabel Torres',
    phone: '912233445',
    email: 'isabel@email.com',
    dni: '01234567',
    birthday: '1993-06-18',
    preferences: 'Mesa con iluminación tenue para cenas',
    allergies: 'Ninguna',
    totalVisits: 7,
    totalReservations: 8,
    lastVisit: '2026-04-02',
    registeredAt: '2025-08-05T16:00:00Z',
    notes: 'Le encanta el pollo a la brasa y pide siempre extra cremas.',
    vip: false,
  },
  {
    id: 'C009',
    name: 'Pedro Vásquez',
    phone: '977665544',
    email: 'pedro@email.com',
    dni: '12309876',
    birthday: '1975-03-05',
    preferences: 'Mesa exterior, área fumador',
    allergies: 'Ninguna',
    totalVisits: 2,
    totalReservations: 3,
    lastVisit: '2026-04-02',
    registeredAt: '2026-03-01T10:00:00Z',
    notes: 'Canceló una reserva sin aviso previo.',
    vip: false,
  },
  {
    id: 'C010',
    name: 'Sandra Reyes',
    phone: '944332211',
    email: 'sandra@email.com',
    dni: '23410987',
    birthday: '1998-08-25',
    preferences: 'Sin preferencia especial',
    allergies: 'Lácteos',
    totalVisits: 1,
    totalReservations: 2,
    lastVisit: '2026-04-01',
    registeredAt: '2026-03-20T12:00:00Z',
    notes: 'No se presentó a una reserva. Intolerancia a lácteos.',
    vip: false,
  },
  {
    id: 'C011',
    name: 'Enrique Huamán',
    phone: '955443322',
    email: 'enrique@email.com',
    dni: '34521098',
    birthday: '1970-11-15',
    preferences: 'Mesa privada, reuniones de trabajo frecuentes',
    allergies: 'Ninguna',
    totalVisits: 9,
    totalReservations: 10,
    lastVisit: '2026-03-31',
    registeredAt: '2024-09-15T09:00:00Z',
    notes: 'Socio de empresa. Siempre trae clientes de negocios.',
    vip: true,
  },
  {
    id: 'C012',
    name: 'Valeria Cruz',
    phone: '966554433',
    email: 'valeria@email.com',
    dni: '45632109',
    birthday: '1997-04-10',
    preferences: 'Decoración floral, música suave',
    allergies: 'Ninguna',
    totalVisits: 5,
    totalReservations: 5,
    lastVisit: '2026-03-30',
    registeredAt: '2025-10-01T11:00:00Z',
    notes: 'Hace cumpleaños aquí con sus amigos.',
    vip: false,
  },
]

// ── Creación del contexto ─────────────────────────────────────────────────────
const ClientContext = createContext(null)

// ── Provider principal ────────────────────────────────────────────────────────
export function ClientProvider({ children }) {
  const [clients, setClients] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Cargar clientes desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pardos_clients')
      if (saved) {
        setClients(JSON.parse(saved))
      } else {
        setClients(SAMPLE_CLIENTS)
      }
    } catch {
      setClients(SAMPLE_CLIENTS)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Persistir en localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('pardos_clients', JSON.stringify(clients))
    }
  }, [clients, isLoading])

  /** Genera ID único de cliente */
  const generateId = () => `C${Date.now().toString().slice(-6)}`

  /** addClient — Registra un nuevo cliente. */
  const addClient = useCallback((data) => {
    const newClient = {
      ...data,
      id: generateId(),
      totalVisits: 0,
      totalReservations: 0,
      lastVisit: null,
      registeredAt: new Date().toISOString(),
      vip: false,
    }
    setClients(prev => [newClient, ...prev])
    return newClient
  }, [])

  /** updateClient — Actualiza datos de un cliente. */
  const updateClient = useCallback((id, updates) => {
    setClients(prev =>
      prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)
    )
  }, [])

  /** searchClients — Búsqueda de clientes por nombre, teléfono o email. */
  const searchClients = useCallback((query) => {
    if (!query || query.length < 2) return clients
    const q = query.toLowerCase()
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.dni?.includes(q)
    )
  }, [clients])

  /** getClientById — Obtiene un cliente por ID. */
  const getClientById = useCallback((id) => {
    return clients.find(c => c.id === id) || null
  }, [clients])

  /** incrementVisits — Incrementa el contador de visitas de un cliente. */
  const incrementVisits = useCallback((id) => {
    setClients(prev =>
      prev.map(c =>
        c.id === id
          ? {
              ...c,
              totalVisits: (c.totalVisits || 0) + 1,
              lastVisit: new Date().toISOString().split('T')[0],
            }
          : c
      )
    )
  }, [])

  /** findByPhone — Busca un cliente por número de teléfono exacto. */
  const findByPhone = useCallback((phone) => {
    return clients.find(c => c.phone === phone.trim()) || null
  }, [clients])

  const value = {
    clients,
    isLoading,
    totalClients: clients.length,
    vipClients: clients.filter(c => c.vip),
    addClient,
    updateClient,
    searchClients,
    getClientById,
    incrementVisits,
    findByPhone,
  }

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>
}

// ── Hook personalizado ────────────────────────────────────────────────────────
export function useClients() {
  const ctx = useContext(ClientContext)
  if (!ctx) throw new Error('useClients debe usarse dentro de <ClientProvider>')
  return ctx
}

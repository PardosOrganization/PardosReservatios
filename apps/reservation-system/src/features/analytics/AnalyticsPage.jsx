/**
 * src/features/analytics/AnalyticsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de Analíticas — exclusiva del Administrador.
 * Usa Recharts para gráficas interactivas y profesionales:
 *
 *   1. AreaChart — Ingresos diarios con gradiente y tooltip detallado
 *   2. BarChart compuesto — Reservas vs Comensales por día
 *   3. PieChart (donut) — Desglose de métodos de pago
 *   4. RadarChart — Horas pico (vista radial)
 *   5. KPIs con tendencia vs período anterior
 *   6. Tabla semanal con minibarra inline
 *
 * Acceso: Solo Administrador
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Users, CalendarCheck, Award } from 'lucide-react'
import { useReservations, RESERVATION_STATUS } from '../../context/ReservationContext'
import { useCash, PAYMENT_METHODS } from '../../context/CashContext'
import { Card } from '../../components/ui/Card'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import styles from './AnalyticsPage.module.css'

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  red:     '#e8453c',
  redSoft: '#fdf1f0',
  blue:    '#2980b9',
  green:   '#27ae60',
  purple:  '#8e44ad',
  orange:  '#e67e22',
  grid:    '#f0ebe3',
  text:    '#9b8a7a',
  dark:    '#3b1a1a',
}

const METHOD_COLORS = {
  efectivo:      C.green,
  tarjeta:       C.blue,
  yape:          C.purple,
  transferencia: C.orange,
}

// ── Helper: genera datos diarios ──────────────────────────────────────────────
function buildDaily(reservations, payments, days) {
  return Array.from({ length: days }, (_, i) => {
    const date    = subDays(new Date(), days - 1 - i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayPay  = payments.filter(p => p.date === dateStr)
    const dayRes  = reservations.filter(r => r.date === dateStr)
    return {
      label:  format(date, 'dd/MM'),
      dia:    format(date, 'EEE', { locale: es }).slice(0, 3),
      income: dayPay.reduce((s, p) => s + p.amount, 0),
      guests: dayRes.reduce((s, r) => s + (Number(r.guests) || 0), 0),
      count:  dayRes.length,
    }
  })
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────
const TooltipIncome = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      <p className={styles.tooltipValue} style={{ color: C.red }}>
        <strong>S/ {payload[0]?.value?.toFixed(2)}</strong>
      </p>
    </div>
  )
}

const TooltipGuests = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 12, margin: '2px 0' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Label personalizado en Pie ────────────────────────────────────────────────
const PIE_RADIAN = Math.PI / 180
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  if (percent < 0.05) return null
  const r  = innerRadius + (outerRadius - innerRadius) * 0.55
  const x  = cx + r * Math.cos(-midAngle * PIE_RADIAN)
  const y  = cy + r * Math.sin(-midAngle * PIE_RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight="700">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, prev, prefix = '', suffix = '', icon, accent }) {
  const delta = prev > 0 ? ((value - prev) / prev) * 100 : null
  const up    = delta !== null && delta >= 0
  const fmt   = typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value
  return (
    <div className={styles.kpiCard} style={{ '--accent': accent }}>
      <div className={styles.kpiIcon}>{icon}</div>
      <div>
        <p className={styles.kpiLabel}>{label}</p>
        <p className={styles.kpiValue}>{prefix}{fmt}{suffix}</p>
        {delta !== null && (
          <p className={`${styles.kpiDelta} ${up ? styles.kpiUp : styles.kpiDown}`}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(delta).toFixed(0)}% vs período anterior
          </p>
        )}
      </div>
    </div>
  )
}

// ── Horas pico (RadarChart) ────────────────────────────────────────────────────
const HOUR_SLOTS = [
  '12:00','13:00','14:00','15:00','16:00',
  '17:00','18:00','19:00','20:00','21:00',
]

// ── Página ────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { reservations } = useReservations()
  const { payments }     = useCash()
  const [period, setPeriod] = useState(14)

  const daily = useMemo(() => buildDaily(reservations, payments, period), [reservations, payments, period])

  // ── KPIs ──────────────────────────────────────────────────────
  const filterByPeriod = (arr, daysAgo, field = 'date') =>
    arr.filter(x => x[field] >= format(subDays(new Date(), daysAgo), 'yyyy-MM-dd'))

  const curPay  = filterByPeriod(payments, period)
  const prevPay = payments.filter(x =>
    x.date >= format(subDays(new Date(), period * 2), 'yyyy-MM-dd') &&
    x.date <  format(subDays(new Date(), period),     'yyyy-MM-dd')
  )
  const curRes  = filterByPeriod(reservations, period)
  const prevRes = reservations.filter(x =>
    x.date >= format(subDays(new Date(), period * 2), 'yyyy-MM-dd') &&
    x.date <  format(subDays(new Date(), period),     'yyyy-MM-dd')
  )

  const totalIncome = curPay.reduce((s, p) => s + p.amount, 0)
  const prevIncome  = prevPay.reduce((s, p) => s + p.amount, 0)
  const avgTicket   = curPay.length > 0 ? totalIncome / curPay.length : 0
  const totalGuests = curRes.reduce((s, r) => s + (Number(r.guests) || 0), 0)

  // ── Métodos de pago ────────────────────────────────────────────
  const pieData = PAYMENT_METHODS
    .map(m => ({
      name:  m.label,
      value: payments.filter(p => p.method === m.id).reduce((s, p) => s + p.amount, 0),
      color: METHOD_COLORS[m.id],
    }))
    .filter(d => d.value > 0)

  // ── Horas pico (radar) ─────────────────────────────────────────
  const radarData = HOUR_SLOTS.map(slot => ({
    hour:  slot,
    count: reservations.filter(r => r.time === slot).length,
  }))

  // ── Semanas ────────────────────────────────────────────────────
  const weeklyStats = Array.from({ length: 4 }, (_, w) => {
    const start = format(subDays(new Date(), (4 - w) * 7 - 1), 'yyyy-MM-dd')
    const end   = format(subDays(new Date(), (3 - w) * 7), 'yyyy-MM-dd')
    const wRes  = reservations.filter(r => r.date >= start && r.date <= end)
    const wPay  = payments.filter(p => p.date >= start && p.date <= end)
    return {
      label:       `Sem. ${w + 1}`,
      reservas:    wRes.length,
      comensales:  wRes.reduce((s, r) => s + (Number(r.guests) || 0), 0),
      completadas: wRes.filter(r => r.status === RESERVATION_STATUS.COMPLETED).length,
      ingresos:    wPay.reduce((s, p) => s + p.amount, 0),
    }
  })
  const maxInc = Math.max(...weeklyStats.map(w => w.ingresos), 1)

  // ── Promedio para la línea de referencia ───────────────────────
  const avgIncome = daily.filter(d => d.income > 0).length > 0
    ? daily.reduce((s, d) => s + d.income, 0) / daily.filter(d => d.income > 0).length
    : 0

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Analíticas</h1>
          <p className={styles.subtitle}>Panel ejecutivo — métricas e ingresos del negocio</p>
        </div>
        <div className={styles.periodGroup}>
          {[7, 14, 30].map(d => (
            <button key={d} id={`period-${d}`}
              className={`${styles.periodBtn} ${period === d ? styles.periodActive : ''}`}
              onClick={() => setPeriod(d)}>
              {d} días
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <KpiCard label="Ingresos del período" value={totalIncome} prev={prevIncome}
          prefix="S/ " icon={<DollarSign size={20} />} accent={C.red} />
        <KpiCard label="Ticket promedio"       value={avgTicket}  prev={0}
          prefix="S/ " icon={<TrendingUp size={20} />}  accent={C.blue} />
        <KpiCard label="Total reservas"        value={curRes.length} prev={prevRes.length}
          icon={<CalendarCheck size={20} />} accent={C.orange} />
        <KpiCard label="Total comensales"      value={totalGuests} prev={0}
          icon={<Users size={20} />}         accent={C.green} />
      </div>

      {/* ── Gráfico 1: Ingresos diarios (AreaChart) ── */}
      <Card
        title={`📈 Ingresos diarios — últimos ${period} días`}
        subtitle={`Total: S/ ${totalIncome.toFixed(2)} · Promedio: S/ ${avgIncome.toFixed(2)}/día`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={daily} margin={{ top: 16, right: 24, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.red} stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.red} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.text }}
              axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `S/${v}`} tick={{ fontSize: 11, fill: C.text }}
              axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<TooltipIncome />} />
            {avgIncome > 0 && (
              <ReferenceLine y={avgIncome} stroke={C.red} strokeDasharray="6 3"
                label={{ value: `Prom. S/${avgIncome.toFixed(0)}`, fill: C.red, fontSize: 10, position: 'insideTopRight' }} />
            )}
            <Area type="monotone" dataKey="income" name="Ingresos"
              stroke={C.red} strokeWidth={2.5} fill="url(#incomeGrad)"
              dot={{ r: 3, fill: '#fff', stroke: C.red, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: C.red, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Gráfico 2: Reservas + Comensales (BarChart compuesto) ── */}
      <Card
        title="📊 Reservas y comensales por día"
        subtitle="Número de reservas (barras) y personas atendidas (línea)"
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={daily} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}
            barCategoryGap="30%">
            <CartesianGrid strokeDasharray="4 4" stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.text }}
              axisLine={false} tickLine={false} />
            <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: C.text }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right"
              tick={{ fontSize: 11, fill: C.blue }} axisLine={false} tickLine={false} />
            <Tooltip content={<TooltipGuests />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar yAxisId="left" dataKey="count"  name="Reservas"    fill={C.orange} radius={[4,4,0,0]} />
            <Bar yAxisId="right" dataKey="guests" name="Comensales"  fill={C.blue}   radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className={styles.grid2}>
        {/* ── Gráfico 3: Métodos de pago (PieChart donut) ── */}
        <Card title="💳 Métodos de pago" subtitle="Distribución total acumulada">
          {pieData.length > 0 ? (
            <div className={styles.pieWrap}>
              <ResponsiveContainer width={220} height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%"
                    innerRadius={55} outerRadius={95}
                    dataKey="value" labelLine={false}
                    label={renderPieLabel}
                    paddingAngle={2}>
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`S/ ${v.toFixed(2)}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.pieLegend}>
                {pieData.map((d, i) => (
                  <div key={i} className={styles.pieLegendItem}>
                    <span className={styles.pieDot} style={{ background: d.color }} />
                    <span className={styles.pieLabel}>{d.name}</span>
                    <span className={styles.pieValue}>S/ {d.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className={styles.empty}>Sin pagos registrados</p>
          )}
        </Card>

        {/* ── Gráfico 4: Horas pico (RadarChart) ── */}
        <Card title="⏰ Horas pico" subtitle="Frecuencia de reservas por franja horaria">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
              <PolarGrid stroke={C.grid} />
              <PolarAngleAxis dataKey="hour" tick={{ fontSize: 10, fill: C.text }} />
              <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={{ fontSize: 9, fill: C.text }} />
              <Radar name="Reservas" dataKey="count"
                stroke={C.orange} fill={C.orange} fillOpacity={0.35} strokeWidth={2} />
              <Tooltip formatter={(v) => [`${v} reservas`, 'Hora']} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Tabla semanal ────────────────────────────── */}
      <Card title="📅 Rendimiento semanal" subtitle="Comparativa de las últimas 4 semanas" noPadding>
        <table className={styles.weekTable}>
          <thead>
            <tr>
              <th>Semana</th>
              <th>Reservas</th>
              <th>Comensales</th>
              <th>Completadas</th>
              <th>Ingresos</th>
              <th>Barra</th>
            </tr>
          </thead>
          <tbody>
            {weeklyStats.map(w => (
              <tr key={w.label}>
                <td className={styles.weekLabel}>{w.label}</td>
                <td className={styles.center}>{w.reservas}</td>
                <td className={styles.center}>{w.comensales}</td>
                <td className={styles.center}>
                  <span className={styles.badge}>{w.completadas}</span>
                </td>
                <td className={styles.incomeCell}>S/ {w.ingresos.toFixed(2)}</td>
                <td>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill}
                      style={{ width: `${(w.ingresos / maxInc) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

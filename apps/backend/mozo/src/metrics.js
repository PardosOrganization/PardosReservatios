/**
 * svc-mozo/src/metrics.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Métricas Prometheus del servicio: instrumentación HTTP y contadores
 * de negocio. Solo observa las peticiones; nunca altera su flujo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import client from 'prom-client'

// Evita el error de doble registro cuando el módulo se recarga (tests con vitest)
function getOrCreate(Type, config) {
  return client.register.getSingleMetric(config.name) || new Type(config)
}

// ── Métricas HTTP ────────────────────────────────────────────────────────────
export const httpRequestsTotal = getOrCreate(client.Counter, {
  name: 'http_requests_total',
  help: 'Total de peticiones HTTP recibidas',
  labelNames: ['method', 'route', 'status_code'],
})

export const httpRequestDuration = getOrCreate(client.Histogram, {
  name: 'http_request_duration_seconds',
  help: 'Duración de las peticiones HTTP en segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
})

/** Middleware Express: registra contador y duración de cada petición. */
export function httpMetricsMiddleware(req, res, next) {
  if (req.path === '/metrics') return next()
  const endTimer = httpRequestDuration.startTimer()
  res.on('finish', () => {
    // req.route existe recién al finalizar; usa el patrón (/api/x/:id) y no la URL cruda
    const route = req.route?.path ? (req.baseUrl || '') + req.route.path : req.path
    const labels = { method: req.method, route, status_code: res.statusCode }
    httpRequestsTotal.inc(labels)
    endTimer(labels)
  })
  next()
}

// ── Métricas de negocio ──────────────────────────────────────────────────────
export const notificacionesLeidas = getOrCreate(client.Counter, {
  name: 'pardos_notificaciones_leidas_total',
  help: 'Total de notificaciones de cocina marcadas como leídas por el mozo',
})

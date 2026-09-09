import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

/**
 * Registro Prometheus único de la aplicación. Las métricas pedidas por el
 * prompt maestro (§22): http_requests_total, http_request_duration_seconds,
 * external_requests_total, external_request_duration_seconds,
 * cache_hits_total, cache_misses_total, api_errors_total.
 */
export const register = new Registry();
collectDefaultMetrics({ register });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Peticiones HTTP recibidas, por ruta, método y código de estado',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de las peticiones HTTP, por ruta y método',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const externalRequestsTotal = new Counter({
  name: 'external_requests_total',
  help: 'Llamadas realizadas a fuentes externas, por fuente y resultado',
  labelNames: ['source', 'outcome'] as const,
  registers: [register],
});

export const externalRequestDuration = new Histogram({
  name: 'external_request_duration_seconds',
  help: 'Duración de las llamadas a fuentes externas, por fuente',
  labelNames: ['source'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Aciertos de caché, por dominio (prefijo de la clave)',
  labelNames: ['domain'] as const,
  registers: [register],
});

export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Fallos de caché, por dominio (prefijo de la clave)',
  labelNames: ['domain'] as const,
  registers: [register],
});

export const apiErrorsTotal = new Counter({
  name: 'api_errors_total',
  help: 'Errores devueltos por la API, por código de error y estado HTTP',
  labelNames: ['code', 'status_code'] as const,
  registers: [register],
});

/**
 * Envuelve una llamada a una fuente externa para medir su duración y
 * contar éxitos/fallos, sin que cada Client tenga que instrumentar a mano
 * cada punto de fetch. Se usa una única vez por Client, envolviendo su
 * método interno de llamada HTTP.
 */
export async function withExternalRequestMetrics<T>(
  source: string,
  fn: () => Promise<T>,
): Promise<T> {
  const endTimer = externalRequestDuration.startTimer({ source });
  try {
    const result = await fn();
    externalRequestsTotal.inc({ source, outcome: 'success' });
    return result;
  } catch (err) {
    externalRequestsTotal.inc({ source, outcome: 'error' });
    throw err;
  } finally {
    endTimer();
  }
}

/** Dominio (prefijo antes de ":") de una clave de caché, para etiquetar la métrica sin cardinalidad descontrolada. */
export function cacheDomainFromKey(key: string): string {
  return key.split(':')[0] ?? 'unknown';
}

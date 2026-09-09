import type { CacheService } from '../cache/CacheService.js';
import type { FarmaciaService } from '../services/FarmaciaService.js';
import type { WeatherService } from '../services/WeatherService.js';
import type { AmbienteService } from '../services/AmbienteService.js';
import type { ParkingService } from '../services/ParkingService.js';
import type { ResiduosService } from '../services/ResiduosService.js';
import type { BusService } from '../services/BusService.js';
import type { RioService } from '../services/RioService.js';

export interface SourceCheckDeps {
  cache: CacheService;
  farmacia: FarmaciaService;
  weather: WeatherService;
  ambiente: AmbienteService;
  parking: ParkingService;
  residuos: ResiduosService;
  bus: BusService;
  rio: RioService;
}

export type CheckStatus = 'ok' | 'degraded' | 'error' | 'excluded';

export interface SourceCheckResult {
  status: CheckStatus;
  detail?: string;
}

/**
 * Módulos excluidos de la v1 por decisión tomada (no "pendientes de
 * construir" — ver docs/architecture-proposal.md §6).
 */
export const EXCLUDED_DEEP_CHECKS = ['eventos', 'cortescalles'] as const;

/**
 * Comprueba en vivo el estado de cada fuente de datos. Compartido entre
 * `GET /health/deep` (diagnóstico de operación) y `GET /api/v1/meta/estado`
 * (equivalente de cara al consumidor externo, §3 ítem 19 de
 * docs/architecture-proposal.md) para no duplicar esta lógica en dos sitios.
 */
export async function runSourceChecks(
  deps: SourceCheckDeps,
): Promise<Record<string, SourceCheckResult>> {
  const checks: Record<string, SourceCheckResult> = {};

  try {
    // Prefijo "diagnostics:" a propósito: cacheDomainFromKey() en
    // src/telemetry/metrics.ts agrupa las métricas de caché por el segmento
    // antes de ":" — una clave sin prefijo ensuciaría cache_hits_total /
    // cache_misses_total con un dominio de un solo uso.
    const probeKey = 'diagnostics:probe';
    await deps.cache.set(probeKey, true, 5);
    const value = await deps.cache.get<boolean>(probeKey);
    checks.cache = { status: value === true ? 'ok' : 'error' };
  } catch (err) {
    checks.cache = { status: 'error', detail: (err as Error).message };
  }

  try {
    const pharmacies = await deps.farmacia.listPharmacies();
    checks.farmacia = {
      status: pharmacies.length > 0 ? 'ok' : 'error',
      detail: `${pharmacies.length} farmacias en catálogo`,
    };
  } catch (err) {
    checks.farmacia = { status: 'error', detail: (err as Error).message };
  }

  try {
    const { stale } = await deps.weather.getCurrent();
    checks.weather = {
      status: stale ? 'degraded' : 'ok',
      detail: stale ? 'sirviendo caché obsoleta (Open-Meteo no responde)' : 'ok',
    };
  } catch (err) {
    checks.weather = { status: 'error', detail: (err as Error).message };
  }

  try {
    const { stale } = await deps.ambiente.getToday();
    checks.ambiente = {
      status: stale ? 'degraded' : 'ok',
      detail: stale ? 'sirviendo caché obsoleta (JCyL no responde)' : 'ok',
    };
  } catch (err) {
    checks.ambiente = { status: 'error', detail: (err as Error).message };
  }

  try {
    const parkings = await deps.parking.listPublicParkings();
    const ora = await deps.parking.getOraInfo();
    checks.parking = {
      status: parkings.length > 0 && ora.districts.length > 0 ? 'ok' : 'error',
      detail: `${parkings.length} aparcamientos, ${ora.districts.length} distritos ORA`,
    };
  } catch (err) {
    checks.parking = { status: 'error', detail: (err as Error).message };
  }

  try {
    const contenedores = await deps.residuos.listContenedores();
    checks.residuos = {
      status: contenedores.length > 0 ? 'ok' : 'error',
      detail: `${contenedores.length} tipos de contenedor`,
    };
  } catch (err) {
    checks.residuos = { status: 'error', detail: (err as Error).message };
  }

  try {
    const lines = await deps.bus.listLines();
    const stops = await deps.bus.listStops();
    checks.bus = {
      status: lines.stale || stops.stale ? 'degraded' : 'ok',
      detail:
        lines.stale || stops.stale
          ? 'sirviendo caché en disco (GTFS de GitHub no responde)'
          : `${lines.data.length} líneas, ${stops.data.length} paradas`,
    };
  } catch (err) {
    checks.bus = { status: 'error', detail: (err as Error).message };
  }

  try {
    const { stale } = await deps.rio.getSnapshot();
    checks.rio = {
      status: stale ? 'degraded' : 'ok',
      detail: stale ? 'sirviendo caché obsoleta (API del río no responde)' : 'ok',
    };
  } catch (err) {
    checks.rio = { status: 'error', detail: (err as Error).message };
  }

  for (const source of EXCLUDED_DEEP_CHECKS) {
    checks[source] = {
      status: 'excluded',
      detail:
        'Fuera de alcance de la v1 (decisión del usuario) — ver docs/architecture-proposal.md §6',
    };
  }

  return checks;
}

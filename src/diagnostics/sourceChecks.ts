import type { CacheService } from '../cache/CacheService.js';
import type { FarmaciaService } from '../services/FarmaciaService.js';
import type { WeatherService } from '../services/WeatherService.js';
import type { AmbienteService } from '../services/AmbienteService.js';
import type { ParkingService } from '../services/ParkingService.js';
import type { ResiduosService } from '../services/ResiduosService.js';
import type { BusService } from '../services/BusService.js';
import type { RioService } from '../services/RioService.js';
import type { EmbalseService } from '../services/EmbalseService.js';
import type { EducacionService } from '../services/EducacionService.js';
import type { BibliotecasService } from '../services/BibliotecasService.js';
import type { AvisosService } from '../services/AvisosService.js';
import { UpstreamError } from '../errors/AppError.js';

export interface SourceCheckDeps {
  cache: CacheService;
  farmacia: FarmaciaService;
  weather: WeatherService;
  ambiente: AmbienteService;
  parking: ParkingService;
  residuos: ResiduosService;
  bus: BusService;
  rio: RioService;
  embalse: EmbalseService;
  educacion: EducacionService;
  bibliotecas: BibliotecasService;
  avisos: AvisosService;
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

async function checkCache(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    // Prefijo "diagnostics:" a propósito: cacheDomainFromKey() en
    // src/telemetry/metrics.ts agrupa las métricas de caché por el segmento
    // antes de ":" — una clave sin prefijo ensuciaría cache_hits_total /
    // cache_misses_total con un dominio de un solo uso.
    const probeKey = 'diagnostics:probe';
    await deps.cache.set(probeKey, true, 5);
    const value = await deps.cache.get<boolean>(probeKey);
    return { status: value === true ? 'ok' : 'error' };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkFarmacia(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    const pharmacies = await deps.farmacia.listPharmacies();
    return {
      status: pharmacies.length > 0 ? 'ok' : 'error',
      detail: `${pharmacies.length} farmacias en catálogo`,
    };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkWeather(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    const { stale } = await deps.weather.getCurrent();
    return {
      status: stale ? 'degraded' : 'ok',
      detail: stale ? 'sirviendo caché obsoleta (Open-Meteo no responde)' : 'ok',
    };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkAmbiente(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    const { stale } = await deps.ambiente.getToday();
    return {
      status: stale ? 'degraded' : 'ok',
      detail: stale ? 'sirviendo caché obsoleta (JCyL no responde)' : 'ok',
    };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkParking(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    const parkings = await deps.parking.listPublicParkings();
    const ora = await deps.parking.getOraInfo();
    return {
      status: parkings.length > 0 && ora.districts.length > 0 ? 'ok' : 'error',
      detail: `${parkings.length} aparcamientos, ${ora.districts.length} distritos ORA`,
    };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkResiduos(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    const contenedores = await deps.residuos.listContenedores();
    return {
      status: contenedores.length > 0 ? 'ok' : 'error',
      detail: `${contenedores.length} tipos de contenedor`,
    };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkBus(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    const lines = await deps.bus.listLines();
    const stops = await deps.bus.listStops();
    return {
      status: lines.stale || stops.stale ? 'degraded' : 'ok',
      detail:
        lines.stale || stops.stale
          ? 'sirviendo caché en disco (GTFS de GitHub no responde)'
          : `${lines.data.length} líneas, ${stops.data.length} paradas`,
    };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkRio(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    const { stale } = await deps.rio.getSnapshot();
    return {
      status: stale ? 'degraded' : 'ok',
      detail: stale ? 'sirviendo caché obsoleta (API del río no responde)' : 'ok',
    };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkEmbalse(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    const { stale } = await deps.embalse.getSnapshot();
    return {
      status: stale ? 'degraded' : 'ok',
      detail: stale ? 'sirviendo caché obsoleta (SAIH Duero no responde)' : 'ok',
    };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkEducacion(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    const { data, stale } = await deps.educacion.listCentros();
    return {
      status: stale ? 'degraded' : data.length > 0 ? 'ok' : 'error',
      detail: stale ? 'sirviendo caché obsoleta (JCyL no responde)' : `${data.length} centros`,
    };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkBibliotecas(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    const { data, stale } = await deps.bibliotecas.listBibliotecas();
    return {
      status: stale ? 'degraded' : data.length > 0 ? 'ok' : 'error',
      detail: stale ? 'sirviendo caché obsoleta (JCyL no responde)' : `${data.length} bibliotecas`,
    };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkAvisos(deps: SourceCheckDeps): Promise<SourceCheckResult> {
  try {
    const { stale } = await deps.avisos.getSnapshot();
    return {
      status: stale ? 'degraded' : 'ok',
      detail: stale ? 'sirviendo caché obsoleta (AEMET no responde)' : 'ok',
    };
  } catch (err) {
    // AVISOS_NOT_CONFIGURED es un estado operativo válido (sin AEMET_API_KEY
    // configurada), no una fuente caída — se marca "degraded", no "error".
    const isNotConfigured = err instanceof UpstreamError && err.code === 'AVISOS_NOT_CONFIGURED';
    return {
      status: isNotConfigured ? 'degraded' : 'error',
      detail: (err as Error).message,
    };
  }
}

/**
 * Comprueba en vivo el estado de cada fuente de datos. Compartido entre
 * `GET /health/deep` (diagnóstico de operación) y `GET /api/v1/meta/estado`
 * (equivalente de cara al consumidor externo, §3 ítem 19 de
 * docs/architecture-proposal.md) para no duplicar esta lógica en dos sitios.
 *
 * Las comprobaciones se lanzan todas en paralelo (cada una ya atrapa su
 * propio error y nunca rechaza la promesa, así que un simple `Promise.all`
 * basta). Antes se hacía `await` una a una: con ~10 fuentes externas reales
 * encadenadas, el tiempo total era la SUMA de cada una — y al añadir
 * `withSingleRetry` a los Client (ver ARCHITECTURE.md, principio 4), un
 * único fallo transitorio en cualquiera de ellas podía doblar su coste y
 * hacer que el total superara el timeout del smoke test (`health/deep
 * (error: This operation was aborted)` en CI, 2026-09-20). En paralelo el
 * total queda acotado por la fuente más lenta, no por la suma de todas.
 */
export async function runSourceChecks(
  deps: SourceCheckDeps,
): Promise<Record<string, SourceCheckResult>> {
  const [
    cache,
    farmacia,
    weather,
    ambiente,
    parking,
    residuos,
    bus,
    rio,
    embalse,
    educacion,
    bibliotecas,
    avisos,
  ] = await Promise.all([
    checkCache(deps),
    checkFarmacia(deps),
    checkWeather(deps),
    checkAmbiente(deps),
    checkParking(deps),
    checkResiduos(deps),
    checkBus(deps),
    checkRio(deps),
    checkEmbalse(deps),
    checkEducacion(deps),
    checkBibliotecas(deps),
    checkAvisos(deps),
  ]);

  const checks: Record<string, SourceCheckResult> = {
    cache,
    farmacia,
    weather,
    ambiente,
    parking,
    residuos,
    bus,
    rio,
    embalse,
    educacion,
    bibliotecas,
    avisos,
  };

  for (const source of EXCLUDED_DEEP_CHECKS) {
    checks[source] = {
      status: 'excluded',
      detail:
        'Fuera de alcance de la v1 (decisión del usuario) — ver docs/architecture-proposal.md §6',
    };
  }

  return checks;
}

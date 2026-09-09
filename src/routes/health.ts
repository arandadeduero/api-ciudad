import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { CacheService } from '../cache/CacheService.js';
import type { FarmaciaService } from '../services/FarmaciaService.js';
import type { WeatherService } from '../services/WeatherService.js';
import type { AmbienteService } from '../services/AmbienteService.js';
import type { ParkingService } from '../services/ParkingService.js';
import type { ResiduosService } from '../services/ResiduosService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PackageJson {
  version: string;
}

async function readVersion(): Promise<string> {
  try {
    const raw = await readFile(join(__dirname, '../../package.json'), 'utf-8');
    return (JSON.parse(raw) as PackageJson).version;
  } catch {
    return 'unknown';
  }
}

/**
 * Fuentes de datos aún sin construir (ver docs/architecture-proposal.md) —
 * se listan explícitamente como "not_implemented" en vez de omitirlas u
 * ocultar que faltan. Eventos y cortes de calles están excluidos de la v1
 * por decisión del usuario, no "pendientes".
 */
const PENDING_DEEP_CHECKS = ['bus', 'rio'] as const;
const EXCLUDED_DEEP_CHECKS = ['eventos', 'cortescalles'] as const;

export async function healthRoutes(
  app: FastifyInstance,
  opts: {
    cache: CacheService;
    farmacia: FarmaciaService;
    weather: WeatherService;
    ambiente: AmbienteService;
    parking: ParkingService;
    residuos: ResiduosService;
  },
): Promise<void> {
  const version = await readVersion();
  const startedAt = Date.now();

  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Estado general del servicio',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              version: { type: 'string' },
              uptime: { type: 'number' },
            },
          },
        },
      },
    },
    async () => ({
      status: 'ok',
      version,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
    }),
  );

  app.get(
    '/health/live',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness probe — el proceso está vivo',
      },
    },
    async () => ({ status: 'ok' }),
  );

  app.get(
    '/health/ready',
    {
      schema: {
        tags: ['health'],
        summary: 'Readiness probe — las dependencias críticas responden',
      },
    },
    async (_request, reply) => {
      const checks: Record<string, 'ok' | 'error'> = {};

      try {
        const probeKey = '__health_probe__';
        await opts.cache.set(probeKey, true, 5);
        const value = await opts.cache.get<boolean>(probeKey);
        checks.cache = value === true ? 'ok' : 'error';
      } catch {
        checks.cache = 'error';
      }

      const ready = Object.values(checks).every((status) => status === 'ok');
      reply.status(ready ? 200 : 503);
      return { status: ready ? 'ok' : 'degraded', checks };
    },
  );

  app.get(
    '/health/deep',
    {
      schema: {
        tags: ['health'],
        summary: 'Diagnóstico profundo de todas las fuentes de datos',
      },
    },
    async () => {
      const checks: Record<string, { status: string; detail?: string }> = {
        cache: { status: 'ok' },
      };

      try {
        const probeKey = '__health_deep_probe__';
        await opts.cache.set(probeKey, true, 5);
        const value = await opts.cache.get<boolean>(probeKey);
        checks.cache = { status: value === true ? 'ok' : 'error' };
      } catch (err) {
        checks.cache = { status: 'error', detail: (err as Error).message };
      }

      try {
        const pharmacies = await opts.farmacia.listPharmacies();
        checks.farmacia = {
          status: pharmacies.length > 0 ? 'ok' : 'error',
          detail: `${pharmacies.length} farmacias en catálogo`,
        };
      } catch (err) {
        checks.farmacia = { status: 'error', detail: (err as Error).message };
      }

      try {
        const { stale } = await opts.weather.getCurrent();
        checks.weather = {
          status: stale ? 'degraded' : 'ok',
          detail: stale ? 'sirviendo caché obsoleta (Open-Meteo no responde)' : 'ok',
        };
      } catch (err) {
        checks.weather = { status: 'error', detail: (err as Error).message };
      }

      try {
        const { stale } = await opts.ambiente.getToday();
        checks.ambiente = {
          status: stale ? 'degraded' : 'ok',
          detail: stale ? 'sirviendo caché obsoleta (JCyL no responde)' : 'ok',
        };
      } catch (err) {
        checks.ambiente = { status: 'error', detail: (err as Error).message };
      }

      try {
        const parkings = await opts.parking.listPublicParkings();
        const ora = await opts.parking.getOraInfo();
        checks.parking = {
          status: parkings.length > 0 && ora.districts.length > 0 ? 'ok' : 'error',
          detail: `${parkings.length} aparcamientos, ${ora.districts.length} distritos ORA`,
        };
      } catch (err) {
        checks.parking = { status: 'error', detail: (err as Error).message };
      }

      try {
        const contenedores = await opts.residuos.listContenedores();
        checks.residuos = {
          status: contenedores.length > 0 ? 'ok' : 'error',
          detail: `${contenedores.length} tipos de contenedor`,
        };
      } catch (err) {
        checks.residuos = { status: 'error', detail: (err as Error).message };
      }

      for (const source of PENDING_DEEP_CHECKS) {
        checks[source] = {
          status: 'not_implemented',
          detail: 'Módulo pendiente — ver docs/architecture-proposal.md',
        };
      }

      for (const source of EXCLUDED_DEEP_CHECKS) {
        checks[source] = {
          status: 'excluded',
          detail:
            'Fuera de alcance de la v1 (decisión del usuario) — ver docs/architecture-proposal.md §6',
        };
      }

      return { status: 'ok', checks };
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { CacheService } from '../cache/CacheService.js';

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
 * Estado de cada fuente de datos que se comprobaría en /health/deep una vez
 * implementada. En esta fase ninguna está construida todavía (ver
 * docs/architecture-proposal.md) — se listan explícitamente como
 * "not_implemented" en vez de omitirlas u ocultar que faltan.
 */
const PENDING_DEEP_CHECKS = [
  'farmacia',
  'weather',
  'ambiente',
  'eventos',
  'parking',
  'bus',
  'rio',
  'cortescalles',
] as const;

export async function healthRoutes(
  app: FastifyInstance,
  opts: { cache: CacheService },
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

      for (const source of PENDING_DEEP_CHECKS) {
        checks[source] = {
          status: 'not_implemented',
          detail: 'Módulo pendiente — ver docs/architecture-proposal.md',
        };
      }

      return { status: 'ok', checks };
    },
  );
}

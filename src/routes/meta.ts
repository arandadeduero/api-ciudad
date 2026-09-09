import type { FastifyInstance } from 'fastify';
import { responseSchema } from './schemas.js';
import { SOURCE_CATALOG } from '../telemetry/sources.js';
import {
  runSourceChecks,
  type SourceCheckDeps,
  type CheckStatus,
} from '../diagnostics/sourceChecks.js';

const sourceMetadataSchemaDef = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    module: { type: 'string' },
    provider: { type: 'string' },
    sourceUrl: { type: ['string', 'null'] },
    license: { type: 'string' },
    updateFrequency: { type: 'string' },
    reliability: { type: 'string' },
    status: { type: 'string' },
    notes: { type: 'string' },
  },
} as const;

const sourceCheckSchemaDef = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    detail: { type: 'string' },
  },
} as const;

/**
 * Endpoints de transparencia (§3 ítems 18-19 de docs/architecture-proposal.md,
 * requisito explícito del prompt maestro §32). No son datos de dominio: son
 * metadatos sobre la propia API, por eso viven bajo /api/v1/meta.
 */
export async function metaRoutes(app: FastifyInstance, opts: SourceCheckDeps): Promise<void> {
  app.get(
    '/meta/fuentes',
    {
      schema: {
        tags: ['meta'],
        summary: 'Metadatos de todas las fuentes de datos: procedencia, licencia y fiabilidad',
        response: responseSchema({ type: 'array', items: sourceMetadataSchemaDef }),
      },
    },
    async () => ({
      data: SOURCE_CATALOG,
      meta: {
        source: 'Generado internamente — catálogo documentado en docs/architecture-proposal.md §2',
        retrievedAt: new Date().toISOString(),
        cached: false,
      },
    }),
  );

  app.get(
    '/meta/estado',
    {
      schema: {
        tags: ['meta'],
        summary: 'Estado en vivo de cada fuente externa (ok/degradado/caído)',
        response: responseSchema({
          type: 'object',
          properties: {
            status: { type: 'string' },
            sources: { type: 'object', additionalProperties: sourceCheckSchemaDef },
          },
        }),
      },
    },
    async () => {
      const sources = await runSourceChecks(opts);
      const statuses: CheckStatus[] = Object.values(sources).map((s) => s.status);
      const status = statuses.includes('error')
        ? 'down'
        : statuses.includes('degraded')
          ? 'degraded'
          : 'ok';

      return {
        data: { status, sources },
        meta: {
          source: 'Generado internamente — mismos checks en vivo que GET /health/deep',
          retrievedAt: new Date().toISOString(),
          cached: false,
        },
      };
    },
  );
}

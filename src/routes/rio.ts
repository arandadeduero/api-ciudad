import type { FastifyInstance } from 'fastify';
import type { RioService } from '../services/RioService.js';
import { responseSchema } from './schemas.js';

function envelope<T>(data: T, stale: boolean) {
  return {
    data,
    meta: {
      source: 'SAIH — Confederación Hidrográfica del Duero (vía API de terceros, no oficial)',
      retrievedAt: new Date().toISOString(),
      cached: false,
      ...(stale ? { stale: true } : {}),
    },
  };
}

const readingSchemaDef = {
  type: 'object',
  properties: { timestamp: { type: 'string' }, value: { type: 'number' } },
} as const;

const metricSummarySchemaDef = {
  type: 'object',
  properties: {
    unit: { type: 'string' },
    latest: readingSchemaDef,
    trend: { type: 'string' },
  },
} as const;

const metricSchemaDef = {
  type: 'object',
  properties: {
    unit: { type: 'string' },
    latest: readingSchemaDef,
    trend: { type: 'string' },
    series: { type: 'array', items: readingSchemaDef },
  },
} as const;

export async function rioRoutes(
  app: FastifyInstance,
  opts: { service: RioService },
): Promise<void> {
  const { service } = opts;

  app.get(
    '/rio',
    {
      schema: {
        tags: ['rio'],
        summary: 'Resumen: último nivel y caudal, con tendencia',
        response: responseSchema({
          type: 'object',
          properties: {
            stationCode: { type: 'string' },
            nivel: metricSummarySchemaDef,
            caudal: metricSummarySchemaDef,
            source: { type: 'string' },
          },
        }),
      },
    },
    async () => {
      const { data, stale } = await service.getSnapshot();
      return envelope(data, stale);
    },
  );

  app.get(
    '/rio/nivel',
    {
      schema: {
        tags: ['rio'],
        summary: 'Serie de nivel del río (m), últimas N horas (por defecto 24)',
        querystring: {
          type: 'object',
          properties: { hours: { type: 'integer', minimum: 1, maximum: 720, default: 24 } },
        },
        response: responseSchema(metricSchemaDef),
      },
    },
    async (request) => {
      const { hours } = request.query as { hours?: number };
      const { data, stale } = await service.getMetric('nivel', hours ?? 24);
      return envelope(data, stale);
    },
  );

  app.get(
    '/rio/caudal',
    {
      schema: {
        tags: ['rio'],
        summary: 'Serie de caudal del río (m³/s), últimas N horas (por defecto 24)',
        querystring: {
          type: 'object',
          properties: { hours: { type: 'integer', minimum: 1, maximum: 720, default: 24 } },
        },
        response: responseSchema(metricSchemaDef),
      },
    },
    async (request) => {
      const { hours } = request.query as { hours?: number };
      const { data, stale } = await service.getMetric('caudal', hours ?? 24);
      return envelope(data, stale);
    },
  );
}

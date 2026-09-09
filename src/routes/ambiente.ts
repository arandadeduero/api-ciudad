import type { FastifyInstance } from 'fastify';
import type { AmbienteService } from '../services/AmbienteService.js';
import { responseSchema } from './schemas.js';

function envelope<T>(data: T, cached: boolean, stale: boolean) {
  return {
    data,
    meta: {
      source: 'JCyL — Datos Abiertos (Junta de Castilla y León)',
      retrievedAt: new Date().toISOString(),
      cached,
      ...(stale ? { stale: true } : {}),
    },
  };
}

const pollutantSchemaDef = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    label: { type: 'string' },
    unit: { type: 'string' },
    value: { type: 'number' },
  },
} as const;

const snapshotSchemaDef = {
  type: 'object',
  properties: {
    station: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        province: { type: 'string' },
        location: {
          type: 'object',
          properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
        },
      },
    },
    date: { type: 'string' },
    granularity: { type: 'string' },
    hourly: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          hour: { type: 'string' },
          pollutants: { type: 'array', items: pollutantSchemaDef },
        },
      },
    },
    daily: { type: 'array', nullable: true, items: pollutantSchemaDef },
    source: { type: 'string' },
  },
} as const;

export async function ambienteRoutes(
  app: FastifyInstance,
  opts: { service: AmbienteService },
): Promise<void> {
  const { service } = opts;

  app.get(
    '/ambiente',
    {
      schema: {
        tags: ['ambiente'],
        summary: 'Calidad del aire de hoy en la estación de Aranda de Duero',
        response: responseSchema(snapshotSchemaDef),
      },
    },
    async () => {
      const { data, cached, stale } = await service.getToday();
      return envelope(data, cached, stale);
    },
  );

  app.get(
    '/ambiente/hoy',
    {
      schema: {
        tags: ['ambiente'],
        summary: 'Alias de /ambiente',
        response: responseSchema(snapshotSchemaDef),
      },
    },
    async () => {
      const { data, cached, stale } = await service.getToday();
      return envelope(data, cached, stale);
    },
  );

  app.get(
    '/ambiente/forday/:date',
    {
      schema: {
        tags: ['ambiente'],
        summary:
          'Calidad del aire para una fecha (YYYY-MM-DD). Hoy usa el dataset horario; fechas pasadas, el histórico diario validado (menor resolución, con retraso de publicación)',
        params: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description:
                'Fecha en formato YYYY-MM-DD, no futura. Fechas pasadas muy recientes pueden no tener aún dato histórico publicado (404 HISTORICAL_DATA_NOT_AVAILABLE).',
            },
          },
          required: ['date'],
        },
        response: responseSchema(snapshotSchemaDef),
      },
    },
    async (request) => {
      const { date } = request.params as { date: string };
      const { data, cached, stale } = await service.getForDate(date);
      return envelope(data, cached, stale);
    },
  );
}

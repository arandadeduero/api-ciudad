import type { FastifyInstance } from 'fastify';
import type { RioService } from '../services/RioService.js';
import type { EmbalseService } from '../services/EmbalseService.js';
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

const embalseSchemaDef = {
  type: 'object',
  properties: {
    stationCode: { type: 'string' },
    nombre: { type: 'string' },
    cauce: { type: 'string' },
    municipio: { type: 'string' },
    provincia: { type: 'string' },
    capacidadMaximaHm3: { type: 'number', nullable: true },
    nivelMsnm: {
      type: 'number',
      nullable: true,
      description: 'Cota de la lámina de agua, en metros sobre el nivel del mar.',
    },
    nivelRelativoM: { type: 'number', nullable: true },
    porcentajeLlenado: { type: 'number', nullable: true },
    volumenEmbalsadoHm3: { type: 'number', nullable: true },
    caudalVertidoM3s: { type: 'number', nullable: true },
    ultimaActualizacion: {
      type: 'string',
      nullable: true,
      description:
        'Tal cual la publica la fuente ("DD/MM/YYYY HH:mm", hora de Madrid) — no es ISO 8601.',
    },
    source: { type: 'string' },
  },
} as const;

export async function rioRoutes(
  app: FastifyInstance,
  opts: { service: RioService; embalse: EmbalseService },
): Promise<void> {
  const { service, embalse } = opts;

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
          properties: {
            hours: {
              type: 'integer',
              minimum: 1,
              maximum: 720,
              default: 24,
              description:
                'Ventana de horas hacia atrás a devolver en "series" (1-720 ≈ 30 días). "latest" y "trend" se calculan siempre sobre toda la serie de la fuente, no sobre esta ventana.',
            },
          },
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
          properties: {
            hours: {
              type: 'integer',
              minimum: 1,
              maximum: 720,
              default: 24,
              description:
                'Ventana de horas hacia atrás a devolver en "series" (1-720 ≈ 30 días). "latest" y "trend" se calculan siempre sobre toda la serie de la fuente, no sobre esta ventana.',
            },
          },
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

  app.get(
    '/rio/embalse',
    {
      schema: {
        tags: ['rio'],
        summary: 'Embalse de Linares del Arroyo (SAIH del Duero): cota, % de llenado y volumen',
        description:
          'No es una fuente propia de Aranda de Duero: el embalse está en Maderuelo (Segovia), en el río Riaza (afluente del Duero) — se incluye por su relevancia a nivel de cuenca, igual que la estación de aforo de /rio no está pegada al casco urbano. A diferencia de /rio, no hay API JSON para este dato: se extrae de la ficha HTML pública de saihduero.es, la única fuente que publica el % de volumen embalsado.',
        response: responseSchema(embalseSchemaDef),
      },
    },
    async () => {
      const { data, stale } = await embalse.getSnapshot();
      return {
        data,
        meta: {
          source: data.source,
          retrievedAt: new Date().toISOString(),
          cached: false,
          ...(stale ? { stale: true } : {}),
        },
      };
    },
  );
}

import type { FastifyInstance } from 'fastify';
import type { BusService } from '../services/BusService.js';
import { ValidationError } from '../errors/AppError.js';
import { responseSchema } from './schemas.js';

function envelope<T>(data: T, stale: boolean) {
  return {
    data,
    meta: {
      source: 'GTFS bus urbano de Aranda de Duero (github.com/arandadeduero/gtfs-busurbano)',
      retrievedAt: new Date().toISOString(),
      cached: false,
      ...(stale ? { stale: true } : {}),
    },
  };
}

const lineSchemaDef = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    shortName: { type: 'string' },
    longName: { type: 'string' },
    color: { type: 'string', nullable: true },
  },
} as const;

const stopSchemaDef = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    location: {
      type: 'object',
      properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
    },
    wheelchairAccessible: { type: 'boolean', nullable: true },
  },
} as const;

export async function busRoutes(
  app: FastifyInstance,
  opts: { service: BusService },
): Promise<void> {
  const { service } = opts;

  app.get(
    '/bus',
    {
      schema: {
        tags: ['bus'],
        summary: 'Resumen del servicio: líneas y paradas',
        response: responseSchema({
          type: 'object',
          properties: {
            lines: { type: 'array', items: lineSchemaDef },
            stopCount: { type: 'number' },
          },
        }),
      },
    },
    async () => {
      const [lines, stops] = await Promise.all([service.listLines(), service.listStops()]);
      return envelope(
        { lines: lines.data, stopCount: stops.data.length },
        lines.stale || stops.stale,
      );
    },
  );

  app.get(
    '/bus/lines',
    {
      schema: {
        tags: ['bus'],
        summary: 'Líneas del bus urbano',
        response: responseSchema({ type: 'array', items: lineSchemaDef }),
      },
    },
    async () => {
      const { data, stale } = await service.listLines();
      return envelope(data, stale);
    },
  );

  app.get(
    '/bus/lines/:line',
    {
      schema: {
        tags: ['bus'],
        summary: 'Detalle de una línea',
        params: { type: 'object', properties: { line: { type: 'string' } }, required: ['line'] },
        response: responseSchema(lineSchemaDef),
      },
    },
    async (request) => {
      const { line } = request.params as { line: string };
      const { data, stale } = await service.getLine(line);
      return envelope(data, stale);
    },
  );

  app.get(
    '/bus/stops',
    {
      schema: {
        tags: ['bus'],
        summary: 'Todas las paradas',
        response: responseSchema({ type: 'array', items: stopSchemaDef }),
      },
    },
    async () => {
      const { data, stale } = await service.listStops();
      return envelope(data, stale);
    },
  );

  app.get(
    '/bus/nearest',
    {
      schema: {
        tags: ['bus'],
        summary: 'Parada más cercana a unas coordenadas',
        querystring: {
          type: 'object',
          properties: { lat: { type: 'string' }, lon: { type: 'string' } },
          required: ['lat', 'lon'],
        },
        response: responseSchema({
          type: 'object',
          properties: {
            stop: stopSchemaDef,
            distanceMeters: { type: 'number' },
            lines: {
              type: 'array',
              items: {
                type: 'object',
                properties: { id: { type: 'string' }, shortName: { type: 'string' } },
              },
            },
          },
        }),
      },
    },
    async (request) => {
      const { lat, lon } = request.query as { lat?: string; lon?: string };
      if (!lat || !lon) {
        throw new ValidationError('Los parámetros de query "lat" y "lon" son obligatorios.');
      }
      const { data, stale } = await service.nearest(Number(lat), Number(lon));
      return envelope(data, stale);
    },
  );

  app.get(
    '/bus/stops/:id',
    {
      schema: {
        tags: ['bus'],
        summary: 'Detalle de una parada',
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        response: responseSchema(stopSchemaDef),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { data, stale } = await service.getStop(id);
      return envelope(data, stale);
    },
  );

  app.get(
    '/bus/stop/:id/next',
    {
      schema: {
        tags: ['bus'],
        summary: 'Próximos autobuses en una parada (por defecto, los 2 siguientes)',
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        querystring: {
          type: 'object',
          properties: { count: { type: 'integer', minimum: 1, maximum: 10, default: 2 } },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { count } = request.query as { count?: number };
      const { data, stale } = await service.nextBuses(id, count ?? 2);
      return envelope(data, stale);
    },
  );
}

import type { FastifyInstance } from 'fastify';
import type { ParkingService } from '../services/ParkingService.js';
import { responseSchema } from './schemas.js';

function envelope<T>(data: T) {
  return {
    data,
    meta: {
      source: 'Ayuntamiento de Aranda de Duero — Ordenanza ORA (BOP Burgos 245/2021)',
      retrievedAt: new Date().toISOString(),
      cached: false,
    },
  };
}

const publicParkingSchemaDef = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string' },
    address: { type: 'string' },
    postalCode: { type: 'string' },
    city: { type: 'string' },
    location: {
      type: 'object',
      properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
    },
    hours: { type: 'string' },
    capacity: { type: 'number', nullable: true },
    availableSpaces: { type: 'number', nullable: true },
    availabilityStatus: { type: 'string' },
    phone: { type: 'string', nullable: true },
  },
} as const;

const oraDistrictSchemaDef = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    streets: { type: 'array', items: { type: 'string' } },
    note: { type: 'string', nullable: true },
  },
} as const;

export async function parkingRoutes(
  app: FastifyInstance,
  opts: { service: ParkingService },
): Promise<void> {
  const { service } = opts;

  app.get(
    '/parking',
    {
      schema: {
        tags: ['parking'],
        summary: 'Aparcamientos públicos de Aranda de Duero',
        response: responseSchema({ type: 'array', items: publicParkingSchemaDef }),
      },
    },
    async () => envelope(await service.listPublicParkings()),
  );

  app.get(
    '/parking/ora',
    {
      schema: {
        tags: ['parking'],
        summary: 'Información completa del ORA: horario, duración, exenciones y distritos',
      },
    },
    async () => envelope(await service.getOraInfo()),
  );

  app.get(
    '/parking/ora/:district',
    {
      schema: {
        tags: ['parking'],
        summary: 'Detalle de un distrito ORA (A-F): calles incluidas',
        params: {
          type: 'object',
          properties: { district: { type: 'string' } },
          required: ['district'],
        },
        response: responseSchema(oraDistrictSchemaDef),
      },
    },
    async (request) => {
      const { district } = request.params as { district: string };
      return envelope(await service.getOraDistrict(district));
    },
  );

  app.get(
    '/parking/:id',
    {
      schema: {
        tags: ['parking'],
        summary: 'Detalle de un aparcamiento público por id',
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        response: responseSchema(publicParkingSchemaDef),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return envelope(await service.getPublicParking(id));
    },
  );
}

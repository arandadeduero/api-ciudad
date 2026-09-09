import type { FastifyInstance } from 'fastify';
import type { GuardEntry, Pharmacy } from '../domain/farmacia.js';
import type { FarmaciaService } from '../services/FarmaciaService.js';
import { responseSchema } from './schemas.js';

const pharmacySchemaDef = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    address: { type: 'string' },
    postalCode: { type: 'string' },
    city: { type: 'string' },
    zone: { type: 'string', nullable: true },
    phone: { type: 'string' },
    location: {
      type: 'object',
      properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
    },
  },
} as const;

const guardEntrySchemaDef = {
  type: 'object',
  properties: {
    date: { type: 'string' },
    pharmacy: pharmacySchemaDef,
    holiday: {
      type: 'object',
      nullable: true,
      properties: {
        date: { type: 'string' },
        name: { type: 'string' },
        scope: { type: 'string' },
      },
    },
    lowConfidence: { type: 'boolean' },
  },
} as const;

function envelope<T>(data: T) {
  return {
    data,
    meta: {
      source: 'Colegio Oficial de Farmacéuticos de Burgos (Z.F. Aranda de Duero)',
      retrievedAt: new Date().toISOString(),
      cached: false,
    },
  };
}

function guardEntryDto(entry: GuardEntry) {
  return {
    date: entry.date,
    pharmacy: entry.pharmacy,
    holiday: entry.holiday,
    lowConfidence: entry.lowConfidence,
  };
}

export async function farmaciaRoutes(
  app: FastifyInstance,
  opts: { service: FarmaciaService },
): Promise<void> {
  const { service } = opts;

  app.get(
    '/farmacia',
    {
      schema: {
        tags: ['farmacia'],
        summary: 'Catálogo de farmacias de Aranda de Duero',
        response: responseSchema({ type: 'array', items: pharmacySchemaDef }),
      },
    },
    async () => {
      const pharmacies: Pharmacy[] = await service.listPharmacies();
      return envelope(pharmacies);
    },
  );

  app.get(
    '/farmacia/hoy',
    {
      schema: {
        tags: ['farmacia'],
        summary: 'Farmacia de guardia hoy',
        response: responseSchema(guardEntrySchemaDef),
      },
    },
    async () => {
      const entry = await service.getToday();
      return envelope(guardEntryDto(entry));
    },
  );

  app.get(
    '/farmacia/dashboard',
    {
      schema: {
        tags: ['farmacia'],
        summary: 'Vista agregada: guardia de hoy + próximos días (pensada para UI/kiosco)',
        querystring: {
          type: 'object',
          properties: { days: { type: 'integer', minimum: 1, maximum: 14, default: 5 } },
        },
        response: responseSchema({
          type: 'object',
          properties: {
            today: guardEntrySchemaDef,
            upcoming: { type: 'array', items: guardEntrySchemaDef },
          },
        }),
      },
    },
    async (request) => {
      const { days } = request.query as { days?: number };
      const result = await service.getDashboard(days ?? 5);
      return envelope({
        today: guardEntryDto(result.today),
        upcoming: result.upcoming.map(guardEntryDto),
      });
    },
  );

  app.get(
    '/farmacia/forday/:date',
    {
      schema: {
        tags: ['farmacia'],
        summary: 'Farmacia de guardia para una fecha concreta (YYYY-MM-DD)',
        params: {
          type: 'object',
          properties: { date: { type: 'string' } },
          required: ['date'],
        },
        response: responseSchema(guardEntrySchemaDef),
      },
    },
    async (request) => {
      const { date } = request.params as { date: string };
      const entry = await service.getForDate(date);
      return envelope(guardEntryDto(entry));
    },
  );

  app.get(
    '/farmacia/formonth/:month',
    {
      schema: {
        tags: ['farmacia'],
        summary: 'Farmacias de guardia de un mes completo (YYYY-MM)',
        params: {
          type: 'object',
          properties: { month: { type: 'string' } },
          required: ['month'],
        },
        response: responseSchema({ type: 'array', items: guardEntrySchemaDef }),
      },
    },
    async (request) => {
      const { month } = request.params as { month: string };
      const entries = await service.getForMonth(month);
      return envelope(entries.map(guardEntryDto));
    },
  );
}

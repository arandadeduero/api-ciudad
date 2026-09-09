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
    capacity: {
      type: 'number',
      nullable: true,
      description: 'Siempre null: no hay API de ocupación en tiempo real para ningún aparcamiento.',
    },
    availableSpaces: {
      type: 'number',
      nullable: true,
      description: 'Siempre null, mismo motivo que capacity.',
    },
    availabilityStatus: {
      type: 'string',
      description: 'Siempre "NOT_AVAILABLE" — nunca se inventa un dato de disponibilidad.',
    },
    phone: { type: 'string', nullable: true },
  },
} as const;

const oraDistrictSchemaDef = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Letra del distrito, A-F.' },
    streets: { type: 'array', items: { type: 'string' } },
    note: { type: 'string', nullable: true },
  },
} as const;

const oraScheduleBlockSchemaDef = {
  type: 'object',
  properties: {
    from: { type: 'string', description: 'HH:MM' },
    to: { type: 'string', description: 'HH:MM' },
  },
} as const;

const oraInfoSchemaDef = {
  type: 'object',
  properties: {
    schedule: {
      type: 'object',
      description: 'Horario real según la ordenanza (BOP Burgos 245/2021): L-V 10-14h y 16-20h.',
      properties: {
        mondayToFriday: { type: 'array', items: oraScheduleBlockSchemaDef },
        saturday: { type: 'array', items: oraScheduleBlockSchemaDef },
        sunday: {
          type: 'array',
          items: oraScheduleBlockSchemaDef,
          description: 'Vacío: sin regulación en domingo.',
        },
        exception: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            mondayToSaturday: { type: 'array', items: oraScheduleBlockSchemaDef },
          },
        },
      },
    },
    exemptPeriods: {
      type: 'array',
      description:
        'Periodos sin regulación ORA (Reyes, fiestas patronales, Nochebuena, Nochevieja).',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          dynamic: {
            type: 'boolean',
            description:
              'true si la fecha varía cada año (p. ej. depende del calendario de fiestas patronales).',
          },
        },
      },
    },
    duration: {
      type: 'object',
      properties: {
        residents: { type: 'string' },
        nonResidentsDefault: {
          type: 'object',
          properties: { zone: { type: 'string' }, maxMinutes: { type: 'number' } },
        },
        greenZone: {
          type: 'object',
          description: 'Excepción de duración en un pequeño grupo de calles de zona verde.',
          properties: {
            maxMinutes: { type: 'number' },
            streets: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    exemptVehicles: { type: 'array', items: { type: 'string' } },
    districts: { type: 'array', items: oraDistrictSchemaDef },
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
        description:
          'Fuente: texto legal de la ordenanza municipal (BOP Burgos 245/2021), no la página informativa del Ayuntamiento.',
        response: responseSchema(oraInfoSchemaDef),
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
          properties: {
            district: {
              type: 'string',
              description:
                'Letra de distrito A-F. No distingue mayúsculas/minúsculas ("a" == "A").',
            },
          },
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
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Id del aparcamiento (ver GET /parking).' },
          },
          required: ['id'],
        },
        response: responseSchema(publicParkingSchemaDef),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return envelope(await service.getPublicParking(id));
    },
  );
}

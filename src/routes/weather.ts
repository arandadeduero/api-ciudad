import type { FastifyInstance } from 'fastify';
import type { WeatherService } from '../services/WeatherService.js';
import { responseSchema } from './schemas.js';

function envelope<T>(data: T, cached: boolean, stale: boolean) {
  return {
    data,
    meta: {
      source: 'Open-Meteo (https://open-meteo.com)',
      retrievedAt: new Date().toISOString(),
      cached,
      ...(stale ? { stale: true } : {}),
    },
  };
}

const hourlyPointSchemaDef = {
  type: 'object',
  properties: {
    time: { type: 'string' },
    temperature: { type: 'number' },
    precipitation: { type: 'number' },
    precipitationProbability: { type: 'number' },
    windSpeed: { type: 'number' },
    windDirection: { type: 'number' },
    weatherCode: { type: 'number' },
  },
} as const;

const currentSchemaDef = {
  type: 'object',
  properties: {
    time: { type: 'string' },
    temperature: { type: 'number' },
    apparentTemperature: { type: 'number' },
    humidity: { type: 'number' },
    windSpeed: { type: 'number' },
    windDirection: { type: 'number' },
    precipitation: { type: 'number' },
    cloudCover: { type: 'number' },
    pressure: { type: 'number' },
    uvIndex: { type: 'number' },
  },
} as const;

export async function weatherRoutes(
  app: FastifyInstance,
  opts: { service: WeatherService },
): Promise<void> {
  const { service } = opts;

  app.get(
    '/weather',
    {
      schema: {
        tags: ['weather'],
        summary: 'Tiempo actual y previsión horaria de hoy',
        response: responseSchema({
          type: 'object',
          properties: {
            current: currentSchemaDef,
            today: { type: 'array', items: hourlyPointSchemaDef },
          },
        }),
      },
    },
    async () => {
      const { data, cached, stale } = await service.getCurrent();
      return envelope(data, cached, stale);
    },
  );

  app.get(
    '/weather/hoy',
    {
      schema: {
        tags: ['weather'],
        summary: 'Alias de /weather',
        response: responseSchema({
          type: 'object',
          properties: {
            current: currentSchemaDef,
            today: { type: 'array', items: hourlyPointSchemaDef },
          },
        }),
      },
    },
    async () => {
      const { data, cached, stale } = await service.getCurrent();
      return envelope(data, cached, stale);
    },
  );

  app.get(
    '/weather/forday/:date',
    {
      schema: {
        tags: ['weather'],
        summary: 'Previsión horaria para un día futuro (máx. 7 días vista), YYYY-MM-DD',
        params: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description:
                'Fecha en formato YYYY-MM-DD, entre hoy y hoy+7 días (límite de cobertura de calidad de Open-Meteo).',
            },
          },
          required: ['date'],
        },
        response: responseSchema({
          type: 'object',
          properties: {
            date: { type: 'string' },
            hourly: { type: 'array', items: hourlyPointSchemaDef },
            daily: {
              type: 'object',
              nullable: true,
              properties: {
                date: { type: 'string' },
                sunrise: { type: 'string' },
                sunset: { type: 'string' },
              },
            },
          },
        }),
      },
    },
    async (request) => {
      const { date } = request.params as { date: string };
      const { data, cached, stale } = await service.getForDay(date);
      return envelope(data, cached, stale);
    },
  );
}

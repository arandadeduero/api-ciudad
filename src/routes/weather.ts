import type { FastifyInstance } from 'fastify';
import type { WeatherService } from '../services/WeatherService.js';
import type { AvisosService } from '../services/AvisosService.js';
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

function avisosEnvelope<T>(data: T, stale: boolean) {
  return {
    data,
    meta: {
      source: 'AEMET OpenData (https://opendata.aemet.es)',
      retrievedAt: new Date().toISOString(),
      cached: false,
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

const avisoSchemaDef = {
  type: 'object',
  properties: {
    fenomeno: {
      type: 'string',
      description: 'Evento tal cual lo redacta AEMET, p. ej. "Aviso de nevadas de nivel amarillo".',
    },
    nivel: { type: 'string', description: '"verde" (sin riesgo), "amarillo", "naranja" o "rojo".' },
    severity: { type: 'string' },
    headline: { type: 'string' },
    effective: { type: 'string' },
    onset: { type: 'string', nullable: true },
    expires: { type: 'string' },
  },
} as const;

export async function weatherRoutes(
  app: FastifyInstance,
  opts: { service: WeatherService; avisos: AvisosService },
): Promise<void> {
  const { service, avisos } = opts;

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

  app.get(
    '/weather/avisos',
    {
      schema: {
        tags: ['weather'],
        summary: 'Avisos meteorológicos activos de AEMET para la zona de Aranda de Duero',
        description:
          'Zona AEMET "Meseta de Burgos" (670904) — determinada calculando en qué polígono cae Aranda de Duero contra el propio CAP-XML de AEMET (point-in-polygon), no asumida. Devuelve el nivel de los 9 fenómenos que publica AEMET (viento, nieve, lluvia, tormentas, temperaturas, deshielo, niebla, polvo en suspensión); la mayoría de días todos están en "verde" (sin riesgo) — eso es un resultado normal, no un error.',
        response: responseSchema({
          type: 'object',
          properties: {
            zona: { type: 'string' },
            zonaCodigo: { type: 'string' },
            avisos: { type: 'array', items: avisoSchemaDef },
            hayAvisosActivos: {
              type: 'boolean',
              description: 'true si algún fenómeno está por encima de "verde".',
            },
            source: { type: 'string' },
          },
        }),
      },
    },
    async () => {
      const { data, stale } = await avisos.getSnapshot();
      return avisosEnvelope(data, stale);
    },
  );
}

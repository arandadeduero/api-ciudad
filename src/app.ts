import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { registerErrorHandler } from './errors/error-handler.js';
import securityPlugin from './plugins/security.js';
import openapiPlugin from './plugins/openapi.js';
import { healthRoutes } from './routes/health.js';
import { farmaciaRoutes } from './routes/farmacia.js';
import { weatherRoutes } from './routes/weather.js';
import { createCacheService, type CacheService } from './cache/index.js';
import { FarmaciaRepository } from './repositories/FarmaciaRepository.js';
import { FarmaciaService } from './services/FarmaciaService.js';
import { OpenMeteoClient } from './clients/OpenMeteoClient.js';
import { WeatherService } from './services/WeatherService.js';

export interface BuildAppOptions {
  cache?: CacheService;
}

const REDACT_PATHS = ['req.headers.authorization', 'req.headers.cookie'];

/**
 * Construye la instancia de Fastify sin arrancar el servidor HTTP.
 * Separado de server.ts para poder testear con `app.inject()` (E2E) sin
 * abrir un socket real.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const loggerOptions =
    env.NODE_ENV === 'development'
      ? {
          level: env.LOG_LEVEL,
          transport: { target: 'pino-pretty' as const },
          redact: REDACT_PATHS,
        }
      : { level: env.LOG_LEVEL, redact: REDACT_PATHS };

  const app = Fastify({
    logger: loggerOptions,
    genReqId: () => randomUUID(),
  });

  const cache = options.cache ?? createCacheService();

  registerErrorHandler(app);

  await app.register(sensible);
  await app.register(securityPlugin);
  await app.register(openapiPlugin);

  // Servicios de dominio (Fase 2+), cableados aquí una única vez.
  const farmaciaService = new FarmaciaService(new FarmaciaRepository());
  const openMeteoClient = new OpenMeteoClient(env.OPEN_METEO_BASE_URL, env.OPEN_METEO_TIMEOUT_MS);
  const weatherService = new WeatherService(
    openMeteoClient,
    cache,
    { latitude: env.ARANDA_LATITUDE, longitude: env.ARANDA_LONGITUDE },
    env.WEATHER_CACHE_TTL_SECONDS,
  );

  // /health vive en la raíz (fuera de /api/v1): es infraestructura del
  // proceso, no un dato de dominio versionado.
  await app.register(async (instance) => {
    await healthRoutes(instance, { cache, farmacia: farmaciaService, weather: weatherService });
  }, {});

  await app.register(
    async (instance) => {
      await farmaciaRoutes(instance, { service: farmaciaService });
      await weatherRoutes(instance, { service: weatherService });
    },
    { prefix: '/api/v1' },
  );

  return app;
}

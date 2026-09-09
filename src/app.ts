import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { registerErrorHandler } from './errors/error-handler.js';
import securityPlugin from './plugins/security.js';
import openapiPlugin from './plugins/openapi.js';
import metricsPlugin from './plugins/metrics.js';
import matomoPlugin from './plugins/matomo.js';
import { healthRoutes } from './routes/health.js';
import { farmaciaRoutes } from './routes/farmacia.js';
import { weatherRoutes } from './routes/weather.js';
import { ambienteRoutes } from './routes/ambiente.js';
import { parkingRoutes } from './routes/parking.js';
import { residuosRoutes } from './routes/residuos.js';
import { busRoutes } from './routes/bus.js';
import { rioRoutes } from './routes/rio.js';
import { metaRoutes } from './routes/meta.js';
import { MatomoService } from './services/MatomoService.js';
import { createCacheService, type CacheService } from './cache/index.js';
import { FarmaciaRepository } from './repositories/FarmaciaRepository.js';
import { FarmaciaService } from './services/FarmaciaService.js';
import { OpenMeteoClient } from './clients/OpenMeteoClient.js';
import { WeatherService } from './services/WeatherService.js';
import { JcylClient } from './clients/JcylClient.js';
import { AmbienteService } from './services/AmbienteService.js';
import { ParkingRepository } from './repositories/ParkingRepository.js';
import { ParkingService } from './services/ParkingService.js';
import { ResiduosRepository } from './repositories/ResiduosRepository.js';
import { ResiduosService } from './services/ResiduosService.js';
import { GtfsClient } from './clients/GtfsClient.js';
import { GtfsRepository } from './repositories/GtfsRepository.js';
import { BusService } from './services/BusService.js';
import { RioClient } from './clients/RioClient.js';
import { RioService } from './services/RioService.js';

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
  await app.register(metricsPlugin);

  const matomoService = new MatomoService({
    enabled: env.MATOMO_ENABLED,
    url: env.MATOMO_URL,
    siteId: env.MATOMO_SITE_ID,
    token: env.MATOMO_TOKEN,
  });
  await app.register(matomoPlugin, { matomo: matomoService });

  // Servicios de dominio, cableados aquí una única vez.
  const farmaciaService = new FarmaciaService(new FarmaciaRepository());

  const openMeteoClient = new OpenMeteoClient(env.OPEN_METEO_BASE_URL, env.OPEN_METEO_TIMEOUT_MS);
  const weatherService = new WeatherService(
    openMeteoClient,
    cache,
    { latitude: env.ARANDA_LATITUDE, longitude: env.ARANDA_LONGITUDE },
    env.WEATHER_CACHE_TTL_SECONDS,
  );

  const jcylClient = new JcylClient(env.JCYL_OPENDATA_BASE_URL, env.JCYL_TIMEOUT_MS);
  const ambienteService = new AmbienteService(
    jcylClient,
    cache,
    {
      id: env.JCYL_AIR_QUALITY_STATION_ID,
      name: env.JCYL_AIR_QUALITY_STATION,
      province: env.JCYL_AIR_QUALITY_PROVINCE,
      location: { latitude: env.ARANDA_LATITUDE, longitude: env.ARANDA_LONGITUDE },
    },
    env.JCYL_AIR_QUALITY_DATASET_TODAY,
    env.JCYL_AIR_QUALITY_DATASET_HISTORICAL,
    env.AMBIENTE_CACHE_TTL_SECONDS,
  );

  const parkingService = new ParkingService(new ParkingRepository());
  const residuosService = new ResiduosService(new ResiduosRepository());

  const gtfsClient = new GtfsClient(env.GTFS_URBANO_REPO, env.GTFS_TIMEOUT_MS);
  const busService = new BusService(new GtfsRepository(gtfsClient, env.GTFS_URBANO_CACHE_DIR));

  const rioClient = new RioClient(env.RIVER_API_BASE_URL, env.RIVER_TIMEOUT_MS);
  const rioService = new RioService(
    rioClient,
    cache,
    env.RIVER_STATION_CODE,
    env.RIVER_CACHE_TTL_SECONDS,
  );

  // /health vive en la raíz (fuera de /api/v1): es infraestructura del
  // proceso, no un dato de dominio versionado.
  await app.register(async (instance) => {
    await healthRoutes(instance, {
      cache,
      farmacia: farmaciaService,
      weather: weatherService,
      ambiente: ambienteService,
      parking: parkingService,
      residuos: residuosService,
      bus: busService,
      rio: rioService,
    });
  }, {});

  await app.register(
    async (instance) => {
      await farmaciaRoutes(instance, { service: farmaciaService });
      await weatherRoutes(instance, { service: weatherService });
      await ambienteRoutes(instance, { service: ambienteService });
      await parkingRoutes(instance, { service: parkingService });
      await residuosRoutes(instance, { service: residuosService });
      await busRoutes(instance, { service: busService });
      await rioRoutes(instance, { service: rioService });
      await metaRoutes(instance, {
        cache,
        farmacia: farmaciaService,
        weather: weatherService,
        ambiente: ambienteService,
        parking: parkingService,
        residuos: residuosService,
        bus: busService,
        rio: rioService,
      });
    },
    { prefix: '/api/v1' },
  );

  return app;
}

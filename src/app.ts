import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { registerErrorHandler } from './errors/error-handler.js';
import securityPlugin from './plugins/security.js';
import openapiPlugin from './plugins/openapi.js';
import { healthRoutes } from './routes/health.js';
import { createCacheService, type CacheService } from './cache/index.js';

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

  await app.register(async (instance) => {
    await healthRoutes(instance, { cache });
  }, {});

  return app;
}

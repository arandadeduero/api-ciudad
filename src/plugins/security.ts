import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env.js';

/**
 * Middlewares de seguridad de base (OWASP API Security Top 10, §33 del
 * prompt maestro): cabeceras seguras, CORS configurable y rate limiting.
 */
export default fp(async function securityPlugin(app: FastifyInstance) {
  await app.register(helmet, {
    // La API sirve JSON y Swagger UI, no HTML de terceros embebido; CSP por
    // defecto de helmet es suficiente y no interfiere con /docs.
    global: true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });
});

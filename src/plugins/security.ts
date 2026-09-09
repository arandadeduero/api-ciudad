import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { IncomingMessage } from 'node:http';
import helmetPlugin from '@fastify/helmet';
import { contentSecurityPolicy } from 'helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env.js';

/**
 * Middlewares de seguridad de base (OWASP API Security Top 10, §33 del
 * prompt maestro): cabeceras seguras, CORS configurable y rate limiting.
 */
export default fp(async function securityPlugin(app: FastifyInstance) {
  await app.register(helmetPlugin, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        ...contentSecurityPolicy.getDefaultDirectives(),
        // La API en sí (/api/v1/*, /health, /metrics) solo sirve JSON/texto
        // y nunca refleja contenido de terceros, así que mantiene el
        // script-src 'self' estricto de helmet por defecto. /docs (Scalar,
        // ver src/plugins/openapi.ts) es la única excepción: su HTML
        // arranca con un pequeño <script> inline (no un fichero aparte),
        // que un script-src estricto bloquea — comprobado en vivo,
        // 2026-09-09. Es una página estática de documentación pública sin
        // contenido reflejado de usuario, así que relajar solo esa ruta es
        // un riesgo asumible; no se toca el resto de la superficie.
        'script-src': [
          "'self'",
          (req: IncomingMessage) => (req.url?.startsWith('/docs') ? "'unsafe-inline'" : "'self'"),
        ],
      },
    },
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });
});

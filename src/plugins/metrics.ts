import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { register, httpRequestsTotal, httpRequestDuration } from '../telemetry/metrics.js';

/**
 * Métricas Prometheus (§22 del prompt maestro): expone `GET /metrics` en
 * formato de texto Prometheus y contabiliza cada petición HTTP con un hook
 * `onResponse`.
 *
 * Se etiqueta por `request.routeOptions.url` (la plantilla de la ruta, p. ej.
 * `/api/v1/rio/:metric`) y no por `request.url` (la URL literal): usar la URL
 * real metería un valor distinto por cada parámetro de ruta y dispararía la
 * cardinalidad de las series de Prometheus sin límite.
 *
 * Vive fuera de /api/v1 (como /health): es infraestructura del proceso, no
 * un dato de dominio versionado.
 */
export default fp(async function metricsPlugin(app: FastifyInstance) {
  app.addHook('onResponse', (request, reply, done) => {
    const route = request.routeOptions.url ?? 'unmatched';
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, reply.elapsedTime / 1000);
    done();
  });

  app.get(
    '/metrics',
    {
      schema: {
        tags: ['metrics'],
        summary: 'Métricas en formato Prometheus',
      },
    },
    async (_request, reply) => {
      reply.header('Content-Type', register.contentType);
      return register.metrics();
    },
  );
});

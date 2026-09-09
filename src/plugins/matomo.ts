import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { MatomoService } from '../services/MatomoService.js';

/**
 * Registra un hook `onResponse` que envía cada petición a Matomo como
 * page view, de forma fire-and-forget (ver MatomoService — nunca bloquea
 * ni falla la respuesta real). No hace nada si Matomo está desactivado:
 * `MatomoService.track()` ya comprueba `enabled` internamente, así que este
 * plugin se puede registrar siempre sin ramas condicionales en app.ts.
 */
export default fp(async function matomoPlugin(
  app: FastifyInstance,
  opts: { matomo: MatomoService },
) {
  app.addHook('onResponse', (request, reply, done) => {
    opts.matomo.track({
      path: request.url,
      actionName: `${request.method} ${request.routeOptions.url ?? request.url}`,
    });
    done();
  });
});

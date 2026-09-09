import type { FastifyInstance } from 'fastify';
import type { ResiduosService } from '../services/ResiduosService.js';

function envelope<T>(data: T) {
  return {
    data,
    meta: {
      source: 'Ayuntamiento de Aranda de Duero — Concejalía de Medio Ambiente / Aseo Urbano',
      retrievedAt: new Date().toISOString(),
      cached: false,
    },
  };
}

export async function residuosRoutes(
  app: FastifyInstance,
  opts: { service: ResiduosService },
): Promise<void> {
  const { service } = opts;

  app.get(
    '/residuos/puntolimpio',
    { schema: { tags: ['residuos'], summary: 'Horario y ubicación del Punto Limpio' } },
    async () => envelope(await service.getPuntoLimpio()),
  );

  app.get(
    '/residuos/contenedores',
    {
      schema: {
        tags: ['residuos'],
        summary: 'Tipos de contenedor y horario de depósito donde aplica',
      },
    },
    async () => envelope(await service.listContenedores()),
  );

  app.get(
    '/residuos/contenedores/:tipo',
    {
      schema: {
        tags: ['residuos'],
        summary: 'Detalle de un tipo de contenedor',
        params: { type: 'object', properties: { tipo: { type: 'string' } }, required: ['tipo'] },
      },
    },
    async (request) => {
      const { tipo } = request.params as { tipo: string };
      return envelope(await service.getContenedor(tipo));
    },
  );

  app.get(
    '/residuos/enseres',
    { schema: { tags: ['residuos'], summary: 'Recogida de muebles y enseres voluminosos' } },
    async () => envelope(await service.getEnseres()),
  );

  app.get(
    '/residuos/comercio-carton',
    { schema: { tags: ['residuos'], summary: 'Recogida puerta a puerta de cartón comercial' } },
    async () => envelope(await service.getComercioCarton()),
  );
}

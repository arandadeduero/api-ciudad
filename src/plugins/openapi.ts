import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

/**
 * Documentación OpenAPI 3 generada desde los schemas de las rutas
 * (ver §23 del prompt maestro: la documentación nunca debe divergir del
 * código porque se genera a partir de él).
 */
export default fp(async function openapiPlugin(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'API Ciudad de Aranda de Duero',
        description:
          'Capa de agregación de datos abiertos municipales, regionales y estatales de Aranda de Duero (Burgos, España). Ver docs/architecture-proposal.md en el repositorio para el detalle de fuentes y decisiones de arquitectura.',
        version: '0.1.0',
      },
      servers: [{ url: '/api/v1', description: 'API v1' }],
      tags: [
        { name: 'health', description: 'Estado y diagnóstico del servicio' },
        { name: 'farmacia', description: 'Farmacias de guardia de Aranda de Duero' },
        { name: 'weather', description: 'Meteorología (Open-Meteo)' },
        { name: 'ambiente', description: 'Calidad del aire (JCyL)' },
        { name: 'parking', description: 'Aparcamientos públicos y zona ORA' },
        { name: 'residuos', description: 'Punto limpio, contenedores y recogida de residuos' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
});

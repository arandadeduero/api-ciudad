import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import scalarApiReference from '@scalar/fastify-api-reference';

/**
 * Documentación OpenAPI 3 generada desde los schemas de las rutas
 * (ver §23 del prompt maestro: la documentación nunca debe divergir del
 * código porque se genera a partir de él).
 *
 * La UI es Scalar, no Swagger UI: sirve su JS desde un fichero propio del
 * mismo origen (`/docs/js/scalar.js`), no como <script> inline como hacía
 * Swagger UI — así respeta el CSP por defecto de Helmet (`script-src 'self'`)
 * sin tener que relajarlo. Swagger UI generaba un script de inicialización
 * inline que el navegador bloqueaba (comprobado en vivo, 2026-09-09).
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
        {
          name: 'weather',
          description: 'Meteorología (Open-Meteo) y avisos meteorológicos (AEMET)',
        },
        { name: 'ambiente', description: 'Calidad del aire (JCyL)' },
        { name: 'parking', description: 'Aparcamientos públicos y zona ORA' },
        { name: 'residuos', description: 'Punto limpio, contenedores y recogida de residuos' },
        { name: 'bus', description: 'Bus urbano (GTFS real, L1/L2/L3)' },
        { name: 'rio', description: 'Nivel y caudal del río (SAIH-CHD, vía API de terceros)' },
        { name: 'educacion', description: 'Centros educativos de Aranda de Duero (JCyL)' },
        { name: 'bibliotecas', description: 'Bibliotecas públicas de Aranda de Duero (JCyL)' },
        { name: 'meta', description: 'Transparencia: catálogo de fuentes y estado en vivo' },
        { name: 'metrics', description: 'Métricas Prometheus' },
      ],
    },
  });

  await app.register(scalarApiReference, {
    routePrefix: '/docs',
    // Mantiene la URL histórica /docs/json (comprobada en tests y en
    // scripts/smoke-test.mjs) en vez del /docs/openapi.json por defecto de Scalar.
    openApiDocumentEndpoints: { json: '/json', yaml: '/yaml' },
    configuration: {
      pageTitle: 'API Ciudad de Aranda de Duero — Referencia',
    },
  });
});

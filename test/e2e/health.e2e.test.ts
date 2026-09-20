import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('E2E /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health devuelve 200 y el shape esperado', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ status: 'ok' });
    expect(typeof body.version).toBe('string');
    expect(typeof body.uptime).toBe('number');
  });

  it('GET /health/live devuelve 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /health/ready devuelve 200 con el chequeo de cache en ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', checks: { cache: 'ok' } });
  });

  it('GET /health/deep comprueba todos los módulos implementados de verdad, y lista lo pendiente/excluido', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/deep' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.checks.cache.status).toBe('ok');
    expect(body.checks.farmacia.status).toBe('ok');
    expect(['ok', 'degraded']).toContain(body.checks.weather.status); // depende de Open-Meteo real
    expect(['ok', 'degraded']).toContain(body.checks.ambiente.status); // depende de JCyL real
    expect(body.checks.parking.status).toBe('ok');
    expect(body.checks.residuos.status).toBe('ok');
    expect(['ok', 'degraded']).toContain(body.checks.bus.status); // depende del GTFS real
    expect(['ok', 'degraded']).toContain(body.checks.rio.status); // depende de la API del río real
    expect(['ok', 'degraded']).toContain(body.checks.embalse.status); // depende del SAIH Duero real
    expect(body.checks.educacion.status).toBe('ok');
    expect(body.checks.bibliotecas.status).toBe('ok');
    expect(['ok', 'degraded']).toContain(body.checks.avisos.status); // depende de AEMET real (o AVISOS_NOT_CONFIGURED sin key)
    expect(body.checks.eventos.status).toBe('excluded');
    expect(body.checks.cortescalles.status).toBe('excluded');
  }, 125_000);

  it('GET /docs/json expone un documento OpenAPI válido con todos los módulos documentados', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBe('3.0.3');
    expect(body.info.title).toBe('API Ciudad de Aranda de Duero');

    const paths = Object.keys(body.paths);
    // Endpoints que en algún momento no tuvieron `response` schema (y por
    // tanto no aparecían con shape en Swagger) — se comprueba explícitamente
    // que siguen documentados tras la Fase de robustez/documentación.
    for (const path of [
      '/residuos/puntolimpio',
      '/residuos/atencion-ciudadana',
      '/parking/ora',
      '/bus/stop/{id}/next',
    ]) {
      expect(paths).toContain(path);
      const responses = body.paths[path].get.responses;
      expect(responses['200'].content['application/json'].schema.properties.data).toBeDefined();
    }

    // Parámetros documentados con `description`, no solo tipo — comprobación
    // puntual de que el trabajo de documentación es real y no solo cosmético.
    const nextParams = body.paths['/bus/stop/{id}/next'].get.parameters;
    const countParam = nextParams.find((p: { name: string }) => p.name === 'count');
    expect(countParam.description).toBeTruthy();
  });

  it('GET /docs/ sirve la UI de Scalar con el CSP relajado solo para script-src en esa ruta', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/' });
    expect(res.statusCode).toBe(200);
    // Bug real detectado en vivo (2026-09-09): Scalar arranca con un
    // <script> inline (Scalar.createApiReference(...)), que un
    // script-src 'self' sin 'unsafe-inline' bloquea en el navegador —
    // la página cargaba (200) pero no llegaba a renderizarse. `app.inject()`
    // no ejecuta JS, así que esto solo se detecta inspeccionando la
    // cabecera CSP y el HTML servido, no con una aserción de status code.
    expect(res.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
    expect(res.body).toContain('Scalar.createApiReference');
    expect(res.body).toContain('<script src="js/scalar.js">');
  });

  it('el CSP relajado en /docs no se filtra a las rutas de datos', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia' });
    const csp = res.headers['content-security-policy'] as string;
    // style-src lleva 'unsafe-inline' en toda la API por defecto de helmet
    // (no relacionado con este fix) — la comprobación real es que
    // script-src específicamente se mantiene estricto fuera de /docs.
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src '));
    expect(scriptSrc).not.toContain('unsafe-inline');
  });

  it('GET /ruta-inexistente devuelve 404 con el formato de error estándar', async () => {
    const res = await app.inject({ method: 'GET', url: '/ruta-inexistente' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(typeof body.error.requestId).toBe('string');
  });
});

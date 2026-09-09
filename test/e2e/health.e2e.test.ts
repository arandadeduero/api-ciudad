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
    expect(body.checks.eventos.status).toBe('excluded');
    expect(body.checks.cortescalles.status).toBe('excluded');
  }, 20_000);

  it('GET /docs/json expone un documento OpenAPI válido', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBe('3.0.3');
    expect(body.info.title).toBe('API Ciudad de Aranda de Duero');
  });

  it('GET /ruta-inexistente devuelve 404 con el formato de error estándar', async () => {
    const res = await app.inject({ method: 'GET', url: '/ruta-inexistente' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(typeof body.error.requestId).toBe('string');
  });
});

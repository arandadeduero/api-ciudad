import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('E2E /metrics', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /metrics devuelve texto en formato Prometheus', async () => {
    // Genera al menos una petición HTTP previa para que haya algo que contar.
    await app.inject({ method: 'GET', url: '/health' });

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.body).toContain('http_requests_total');
    expect(res.body).toContain('http_request_duration_seconds');
    expect(res.body).toContain('cache_hits_total');
    expect(res.body).toContain('cache_misses_total');
    expect(res.body).toContain('api_errors_total');
  });

  it('etiqueta http_requests_total por plantilla de ruta, no por URL literal', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/rio/nivel' });

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.body).toMatch(/http_requests_total\{.*route="\/api\/v1\/rio\/nivel".*\}/);
  });

  it('contabiliza un 404 en api_errors_total', async () => {
    await app.inject({ method: 'GET', url: '/no-existe' });

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.body).toMatch(/api_errors_total\{code="ROUTE_NOT_FOUND",status_code="404"\} \d+/);
  });
});

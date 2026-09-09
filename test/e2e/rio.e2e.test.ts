import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

// Golpea la red real de la API del río (saih-chd-api, ver docs/architecture-proposal.md §2.2b).
describe('E2E /api/v1/rio', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/rio devuelve el resumen real de nivel y caudal', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/rio' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.stationCode).toBe('EA013');
    expect(typeof body.data.nivel.latest.value).toBe('number');
    expect(typeof body.data.caudal.latest.value).toBe('number');
    expect(['subiendo', 'bajando', 'estable']).toContain(body.data.nivel.trend);
    expect(body.meta.source).toContain('SAIH');
  }, 15_000);

  it('GET /api/v1/rio/nivel devuelve la serie real de las últimas 24h por defecto', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/rio/nivel' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.unit).toBe('m');
    expect(Array.isArray(body.data.series)).toBe(true);
    expect(body.data.series.length).toBeGreaterThan(0);
  }, 15_000);

  it('GET /api/v1/rio/caudal admite el parámetro hours', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/rio/caudal?hours=6' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.unit).toBe('m³/s');
  }, 15_000);

  it('GET /api/v1/rio/nivel rechaza un hours fuera de rango', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/rio/nivel?hours=0' });
    expect(res.statusCode).toBe(400);
  });
});

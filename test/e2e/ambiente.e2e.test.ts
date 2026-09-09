import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

// Golpea la red real de JCyL (sin API key, ver docs/architecture-proposal.md §2.2).
describe('E2E /api/v1/ambiente', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/ambiente devuelve la calidad del aire real de hoy', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ambiente' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.station.name).toBe('Aranda de Duero 2');
    expect(body.data.granularity).toBe('hourly');
    expect(body.meta.source).toContain('JCyL');
  }, 15_000);

  it('GET /api/v1/ambiente/forday/:date con una fecha histórica devuelve un agregado diario', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ambiente/forday/2025-12-21' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.granularity).toBe('daily');
    expect(body.data.daily.length).toBeGreaterThan(0);
  }, 15_000);

  it('GET /api/v1/ambiente/forday/:date con fecha futura devuelve 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ambiente/forday/2099-01-01' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('DATE_IN_FUTURE');
  });

  it('GET /api/v1/ambiente/forday/:date con formato inválido devuelve 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ambiente/forday/notadate' });
    expect(res.statusCode).toBe(400);
  });
});

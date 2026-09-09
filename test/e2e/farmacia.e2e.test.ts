import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('E2E /api/v1/farmacia', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/farmacia devuelve el catálogo de 12 farmacias', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(12);
    expect(body.meta.source).toContain('Colegio Oficial');
  });

  it('GET /api/v1/farmacia/hoy devuelve la guardia de hoy', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia/hoy' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.pharmacy).toBeDefined();
  });

  it('GET /api/v1/farmacia/forday/:date devuelve la guardia de una fecha concreta', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia/forday/2026-01-01' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.date).toBe('2026-01-01');
    expect(body.data.pharmacy.id).toBe(9);
    expect(body.data.holiday.name).toBe('Año Nuevo');
  });

  it('GET /api/v1/farmacia/forday/:date con fecha inválida devuelve 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia/forday/2026-02-30' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_DATE');
  });

  it('GET /api/v1/farmacia/forday/:date con año sin datos devuelve 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia/forday/2027-01-01' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('YEAR_NOT_AVAILABLE');
  });

  it('GET /api/v1/farmacia/formonth/:month devuelve el mes completo', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia/formonth/2026-01' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(31);
  });

  it('GET /api/v1/farmacia/formonth/:month con mes inválido devuelve 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia/formonth/2026-13' });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/farmacia/dashboard devuelve hoy y próximos días', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia/dashboard?days=3' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.today.pharmacy).toBeDefined();
    expect(body.data.upcoming.length).toBeGreaterThan(0);
  });
});

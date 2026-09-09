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

  it('GET /api/v1/farmacia/dashboard sin query usa el valor por defecto (days=5)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia/dashboard' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.upcoming.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/v1/farmacia/dashboard rechaza days fuera de rango [1,14]', async () => {
    const tooLow = await app.inject({ method: 'GET', url: '/api/v1/farmacia/dashboard?days=0' });
    expect(tooLow.statusCode).toBe(400);

    const tooHigh = await app.inject({ method: 'GET', url: '/api/v1/farmacia/dashboard?days=15' });
    expect(tooHigh.statusCode).toBe(400);
  });

  it('GET /api/v1/farmacia/forday/:date marca lowConfidence en las fechas documentadas como de confianza baja', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia/forday/2026-12-24' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.lowConfidence).toBe(true);
  });

  it('GET /api/v1/farmacia/forday/:date no marca lowConfidence en una fecha normal', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia/forday/2026-03-15' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.lowConfidence).toBe(false);
  });

  it('GET /api/v1/farmacia catálogo: cada farmacia tiene shape completa (incluida location)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/farmacia' });
    expect(res.statusCode).toBe(200);
    for (const pharmacy of res.json().data) {
      expect(pharmacy).toHaveProperty('id');
      expect(pharmacy).toHaveProperty('name');
      expect(pharmacy).toHaveProperty('address');
      expect(pharmacy).toHaveProperty('phone');
      expect(pharmacy.location).toHaveProperty('latitude');
      expect(pharmacy.location).toHaveProperty('longitude');
    }
  });
});

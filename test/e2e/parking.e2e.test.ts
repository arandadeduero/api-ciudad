import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('E2E /api/v1/parking', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/parking devuelve los aparcamientos públicos, siempre con availabilityStatus NOT_AVAILABLE', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/parking' });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.length).toBeGreaterThan(0);
    for (const parking of data) {
      expect(parking.availabilityStatus).toBe('NOT_AVAILABLE');
      expect(parking.capacity).toBeNull();
      expect(parking.availableSpaces).toBeNull();
    }
  });

  it('GET /api/v1/parking/:id devuelve un aparcamiento concreto', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/parking/sol-de-las-moreras' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Sol de las Moreras');
  });

  it('GET /api/v1/parking/:id con id inexistente devuelve 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/parking/no-existe' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/v1/parking/ora devuelve el shape completo: schedule, exemptPeriods, duration, exemptVehicles, districts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/parking/ora' });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();

    // Shape completa: el response schema es una whitelist de serialización
    // (ver ARCHITECTURE.md, Principio #5) — verificamos cada rama anidada.
    expect(data.schedule.mondayToFriday).toEqual([
      { from: '10:00', to: '14:00' },
      { from: '16:00', to: '20:00' },
    ]);
    expect(data.schedule.saturday).toHaveLength(1);
    expect(data.schedule.sunday).toEqual([]);
    expect(data.schedule.exception.location).toBeTruthy();
    expect(data.schedule.exception.mondayToSaturday.length).toBeGreaterThan(0);

    expect(data.exemptPeriods.length).toBe(4);
    expect(data.exemptPeriods.some((p: { dynamic?: boolean }) => p.dynamic === true)).toBe(true);

    expect(data.duration.residents).toBeTruthy();
    expect(data.duration.nonResidentsDefault).toEqual({ zone: 'azul', maxMinutes: 120 });
    expect(data.duration.greenZone.maxMinutes).toBe(240);
    expect(data.duration.greenZone.streets.length).toBeGreaterThan(0);

    expect(data.exemptVehicles.length).toBe(8);

    expect(data.districts).toHaveLength(6);
    for (const district of data.districts) {
      expect(district).toHaveProperty('id');
      expect(district).toHaveProperty('streets');
      expect(district).toHaveProperty('note');
    }
  });

  it('GET /api/v1/parking/ora/:district devuelve un distrito', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/parking/ora/A' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.streets).toContain('Calle Miranda do Douro');
  });

  it('GET /api/v1/parking/ora/:district no distingue mayúsculas/minúsculas', async () => {
    const upper = await app.inject({ method: 'GET', url: '/api/v1/parking/ora/A' });
    const lower = await app.inject({ method: 'GET', url: '/api/v1/parking/ora/a' });
    expect(lower.statusCode).toBe(200);
    expect(lower.json().data).toEqual(upper.json().data);
  });

  it('GET /api/v1/parking/ora/:district con distrito inexistente devuelve 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/parking/ora/Z' });
    expect(res.statusCode).toBe(404);
  });
});

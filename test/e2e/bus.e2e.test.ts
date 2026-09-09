import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

// Golpea la red real de GitHub Releases para descargar el feed GTFS.
describe('E2E /api/v1/bus', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  }, 20_000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/bus devuelve el resumen del servicio', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bus' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.lines.length).toBeGreaterThanOrEqual(3);
    expect(body.data.stopCount).toBeGreaterThan(0);
  }, 20_000);

  it('GET /api/v1/bus/lines lista L1, L2, L3', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bus/lines' });
    expect(res.statusCode).toBe(200);
    const shortNames = res.json().data.map((l: { shortName: string }) => l.shortName);
    expect(shortNames).toEqual(expect.arrayContaining(['L1', 'L2', 'L3']));
  }, 20_000);

  it('GET /api/v1/bus/lines/:line con línea inexistente devuelve 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bus/lines/no-existe' });
    expect(res.statusCode).toBe(404);
  }, 20_000);

  it('GET /api/v1/bus/stops devuelve las paradas reales', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bus/stops' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThan(30);
  }, 20_000);

  it('GET /api/v1/bus/nearest devuelve la parada más cercana a la Plaza Mayor', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bus/nearest?lat=41.6701895&lon=-3.6885626',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.stop.name).toBeTruthy();
    expect(body.data.distanceMeters).toBeGreaterThanOrEqual(0);
  }, 20_000);

  it('GET /api/v1/bus/nearest sin lat/lon devuelve 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bus/nearest' });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/bus/stop/:id/next devuelve como mucho 2 próximos autobuses por defecto, con shape completa', async () => {
    const stopsRes = await app.inject({ method: 'GET', url: '/api/v1/bus/stops' });
    const firstStopId = stopsRes.json().data[0].id;

    const res = await app.inject({ method: 'GET', url: `/api/v1/bus/stop/${firstStopId}/next` });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.nextBuses.length).toBeLessThanOrEqual(2);
    expect(data.stop.id).toBe(firstStopId);
    // Shape completa: el response schema es una whitelist de serialización
    // (ver ARCHITECTURE.md, Principio #5) — se coló dos veces ya en este
    // proyecto (Fase 2 y Fase 4), así que se verifica explícitamente aquí.
    for (const bus of data.nextBuses) {
      expect(bus).toHaveProperty('line');
      expect(bus).toHaveProperty('destination');
      expect(bus).toHaveProperty('scheduledTime');
      expect(bus).toHaveProperty('minutesUntil');
    }
  }, 20_000);

  it('GET /api/v1/bus/stop/:id/next respeta el parámetro count', async () => {
    const stopsRes = await app.inject({ method: 'GET', url: '/api/v1/bus/stops' });
    const firstStopId = stopsRes.json().data[0].id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/bus/stop/${firstStopId}/next?count=1`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.nextBuses.length).toBeLessThanOrEqual(1);
  }, 20_000);

  it('GET /api/v1/bus/stop/:id/next rechaza count fuera de rango [1,10]', async () => {
    const stopsRes = await app.inject({ method: 'GET', url: '/api/v1/bus/stops' });
    const firstStopId = stopsRes.json().data[0].id;

    const tooLow = await app.inject({
      method: 'GET',
      url: `/api/v1/bus/stop/${firstStopId}/next?count=0`,
    });
    expect(tooLow.statusCode).toBe(400);

    const tooHigh = await app.inject({
      method: 'GET',
      url: `/api/v1/bus/stop/${firstStopId}/next?count=11`,
    });
    expect(tooHigh.statusCode).toBe(400);
  }, 20_000);

  it('GET /api/v1/bus/stop/:id/next con parada inexistente devuelve 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bus/stop/no-existe/next' });
    expect(res.statusCode).toBe(404);
  }, 20_000);

  it('GET /api/v1/bus/stops/:id con id inexistente devuelve 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bus/stops/no-existe' });
    expect(res.statusCode).toBe(404);
  }, 20_000);

  it('GET /api/v1/bus/nearest con lat/lon no numéricos devuelve 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bus/nearest?lat=notanumber&lon=-3.6885626',
    });
    expect(res.statusCode).toBe(400);
  }, 20_000);
});

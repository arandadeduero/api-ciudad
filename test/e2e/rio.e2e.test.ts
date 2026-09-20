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
  }, 20_000);

  it('GET /api/v1/rio/nivel devuelve la serie real de las últimas 24h por defecto', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/rio/nivel' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.unit).toBe('m');
    expect(Array.isArray(body.data.series)).toBe(true);
    expect(body.data.series.length).toBeGreaterThan(0);
  }, 20_000);

  it('GET /api/v1/rio/caudal admite el parámetro hours', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/rio/caudal?hours=6' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.unit).toBe('m³/s');
  }, 20_000);

  it('GET /api/v1/rio/nivel rechaza un hours fuera de rango (por debajo)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/rio/nivel?hours=0' });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/rio/caudal rechaza un hours fuera de rango (por encima de 720)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/rio/caudal?hours=721' });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/rio devuelve el shape completo (nivel y caudal con unit/latest/trend)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/rio' });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    for (const metric of [data.nivel, data.caudal]) {
      expect(metric).toHaveProperty('unit');
      expect(metric.latest).toHaveProperty('timestamp');
      expect(metric.latest).toHaveProperty('value');
      expect(metric).toHaveProperty('trend');
    }
  }, 20_000);

  // Golpea la red real de saihduero.es (HTML, no API — ver docs/API-REFERENCE.md).
  it('GET /api/v1/rio/embalse devuelve el estado real del embalse de Linares del Arroyo', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/rio/embalse' });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.stationCode).toBe('EM511');
    expect(data.nombre).toContain('Linares del Arroyo');
    expect(data.cauce).toBe('Riaza');
    expect(data.municipio).toBe('Maderuelo');
    expect(typeof data.nivelMsnm).toBe('number');
    expect(typeof data.porcentajeLlenado).toBe('number');
    expect(data.porcentajeLlenado).toBeGreaterThan(0);
    expect(data.porcentajeLlenado).toBeLessThanOrEqual(100);
    expect(typeof data.capacidadMaximaHm3).toBe('number');
  }, 20_000);
});

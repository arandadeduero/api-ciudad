import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

// Golpea la red real de JCyL (mismo proveedor Opendatasoft que /ambiente).
describe('E2E /api/v1/educacion', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/educacion/centros devuelve los 27 centros reales de Aranda de Duero', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/educacion/centros' });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.length).toBe(27);
    for (const centro of data) {
      expect(centro).toHaveProperty('codigo');
      expect(centro).toHaveProperty('nombre');
      expect(centro).toHaveProperty('naturaleza');
      expect(centro).toHaveProperty('location');
    }
  }, 15_000);

  it('GET /api/v1/educacion/centros marca location null en el registro con coordenada errónea (Cinco Sentidos)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/educacion/centros' });
    const { data } = res.json();
    const cincoSentidos = data.find((c: { nombre: string }) => c.nombre === 'CINCO SENTIDOS');
    expect(cincoSentidos).toBeDefined();
    expect(cincoSentidos.location).toBeNull();
  }, 15_000);

  it('GET /api/v1/educacion/centros/:codigo devuelve el detalle de un centro real', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/educacion/centros/09000239' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.nombre).toBe('CLARET');
  }, 15_000);

  it('GET /api/v1/educacion/centros/:codigo con código inexistente devuelve 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/educacion/centros/no-existe' });
    expect(res.statusCode).toBe(404);
  }, 15_000);
});

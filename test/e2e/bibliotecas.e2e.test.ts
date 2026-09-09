import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

// Golpea la red real de JCyL (mismo proveedor Opendatasoft que /ambiente).
describe('E2E /api/v1/bibliotecas', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/bibliotecas devuelve la Biblioteca Pública Municipal real', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bibliotecas' });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data).toHaveLength(1);
    expect(data[0].nombre).toContain('Biblioteca Pública Municipal de Aranda de Duero');
    expect(data[0].direccion).toBe('Plaza del Trigo 9');
    expect(data[0].location).toHaveProperty('latitude');
    expect(data[0].location).toHaveProperty('longitude');
  }, 15_000);
});

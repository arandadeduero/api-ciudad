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

  it('GET /api/v1/parking devuelve los aparcamientos públicos', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/parking' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThan(0);
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

  it('GET /api/v1/parking/ora devuelve la información completa del ORA', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/parking/ora' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.districts).toHaveLength(6);
  });

  it('GET /api/v1/parking/ora/:district devuelve un distrito', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/parking/ora/A' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.streets).toContain('Calle Miranda do Douro');
  });

  it('GET /api/v1/parking/ora/:district con distrito inexistente devuelve 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/parking/ora/Z' });
    expect(res.statusCode).toBe(404);
  });
});

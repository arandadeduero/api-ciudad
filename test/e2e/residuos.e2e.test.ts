import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('E2E /api/v1/residuos', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/residuos/puntolimpio devuelve el horario del punto limpio', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/puntolimpio' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.direccion).toContain('Aguilera');
  });

  it('GET /api/v1/residuos/contenedores lista los tipos de contenedor', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/contenedores' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(9);
  });

  it('GET /api/v1/residuos/contenedores/:tipo devuelve un tipo concreto', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/contenedores/vidrio' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.color).toContain('verde');
  });

  it('GET /api/v1/residuos/contenedores/:tipo con tipo inexistente devuelve 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/contenedores/no-existe' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/v1/residuos/enseres devuelve el contacto de Valoriza', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/enseres' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.telefono).toBe('947506050');
  });

  it('GET /api/v1/residuos/comercio-carton devuelve el horario', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/comercio-carton' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.horario.desde).toBe('13:00');
  });
});

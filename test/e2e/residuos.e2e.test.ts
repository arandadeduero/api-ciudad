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

  it('GET /api/v1/residuos/puntolimpio devuelve el horario completo del punto limpio', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/puntolimpio' });
    expect(res.statusCode).toBe(200);
    const { data, meta } = res.json();
    expect(data.direccion).toContain('Aguilera');
    // Shape completa: el response schema es una whitelist de serialización
    // (ver ARCHITECTURE.md, Principio #5) — verificamos explícitamente que
    // ningún campo anidado se pierde al declarar el schema.
    expect(data.operador).toBeTruthy();
    expect(data.usuarios).toBeTruthy();
    expect(data.horario.lunesAViernes).toHaveLength(2);
    expect(data.horario.sabado).toHaveLength(1);
    expect(data.horario.excepciones).toBeTruthy();
    expect(meta.source).toContain('Ayuntamiento');
  });

  it('GET /api/v1/residuos/contenedores lista los 9 tipos con su shape completa', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/contenedores' });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data).toHaveLength(9);
    for (const contenedor of data) {
      expect(contenedor).toHaveProperty('tipo');
      expect(contenedor).toHaveProperty('color');
      expect(contenedor).toHaveProperty('descripcion');
      expect(contenedor).toHaveProperty('instrucciones');
      expect(contenedor).toHaveProperty('horarioDeposito');
    }
  });

  it('GET /api/v1/residuos/contenedores/:tipo devuelve un tipo con horarioDeposito (vidrio)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/contenedores/vidrio' });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.color).toContain('verde');
    expect(data.horarioDeposito).toEqual({ desde: '08:00', hasta: '23:00' });
  });

  it('GET /api/v1/residuos/contenedores/:tipo devuelve horarioDeposito null cuando no hay restricción (organica)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/contenedores/organica' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.horarioDeposito).toBeNull();
  });

  it('GET /api/v1/residuos/contenedores/:tipo con tipo inexistente devuelve 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/contenedores/no-existe' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/v1/residuos/enseres devuelve el contacto completo de Valoriza', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/enseres' });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.telefono).toBe('947506050');
    expect(data.operador).toContain('Valoriza');
    expect(data.descripcion).toBeTruthy();
    expect(data.metodo).toBeTruthy();
  });

  it('GET /api/v1/residuos/comercio-carton devuelve el horario y marca la fuente como secundaria', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/comercio-carton' });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.horario.desde).toBe('13:00');
    expect(data.horario.hasta).toBe('14:00');
    expect(data.fuente).toContain('secundaria');
    expect(data.sancionPorIncumplimiento).toBeTruthy();
  });

  it('GET /api/v1/residuos/atencion-ciudadana devuelve teléfono, horario, sede y oficinas', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/residuos/atencion-ciudadana' });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.telefono).toBe('947546353');
    expect(data.horario).toEqual({ desde: '09:00', hasta: '14:00' });
    expect(data.sedeElectronica).toContain('arandadeduero.es');
    expect(data.correo).toContain('@');
    expect(data.oficinas.length).toBeGreaterThanOrEqual(2);
    expect(data.oficinas[0]).toHaveProperty('nombre');
    expect(data.oficinas[0]).toHaveProperty('direccion');
  });
});

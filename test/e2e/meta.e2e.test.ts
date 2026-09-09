import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('E2E /api/v1/meta', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/meta/fuentes devuelve el catálogo completo de fuentes con meta', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/meta/fuentes' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(typeof body.meta.source).toBe('string');
    expect(typeof body.meta.retrievedAt).toBe('string');

    const rio = body.data.find((s: { id: string }) => s.id === 'rio');
    expect(rio).toMatchObject({ status: 'implemented' });

    const eventos = body.data.find((s: { id: string }) => s.id === 'eventos');
    expect(eventos).toMatchObject({ status: 'excluded' });
  });

  it('GET /api/v1/meta/estado agrega el estado en vivo de cada fuente', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/meta/estado' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(['ok', 'degraded', 'down']).toContain(body.data.status);
    expect(body.data.sources.cache.status).toBe('ok');
    expect(body.data.sources.farmacia.status).toBe('ok');
    expect(body.data.sources.eventos.status).toBe('excluded');
    expect(body.data.sources.cortescalles.status).toBe('excluded');
  }, 20_000);
});

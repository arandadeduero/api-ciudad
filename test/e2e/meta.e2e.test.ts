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

    for (const id of ['embalse', 'educacion', 'bibliotecas', 'avisos']) {
      expect(body.data.find((s: { id: string }) => s.id === id)).toMatchObject({
        status: 'implemented',
      });
    }
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
    expect(['ok', 'degraded']).toContain(body.data.sources.embalse.status);
    expect(body.data.sources.educacion.status).toBe('ok');
    expect(body.data.sources.bibliotecas.status).toBe('ok');
    // "degraded" cubre tanto una AEMET real caída como AVISOS_NOT_CONFIGURED sin key.
    expect(['ok', 'degraded']).toContain(body.data.sources.avisos.status);
  }, 20_000);
});

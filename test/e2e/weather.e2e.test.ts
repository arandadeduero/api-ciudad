import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { todayInMadrid, addDays } from '../../src/utils/date.js';

// Estos tests golpean la red real (Open-Meteo no requiere API key y responde
// en milisegundos, ver docs/architecture-proposal.md §2.3) — les damos un
// timeout mayor que el resto de la suite por si acaso.
describe('E2E /api/v1/weather', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/weather devuelve el tiempo actual real de Aranda de Duero', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/weather' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.data.current.temperature).toBe('number');
    expect(body.meta.source).toContain('Open-Meteo');
    expect(body.meta.cached).toBe(false);
  }, 15_000);

  it('GET /api/v1/weather/hoy usa la cache de la petición anterior', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/weather/hoy' });
    expect(res.statusCode).toBe(200);
    expect(res.json().meta.cached).toBe(true);
  }, 15_000);

  it('GET /api/v1/weather/forday/:date acepta un día dentro de los próximos 7', async () => {
    const date = addDays(todayInMadrid(), 3);
    const res = await app.inject({ method: 'GET', url: `/api/v1/weather/forday/${date}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.date).toBe(date);
  }, 15_000);

  it('GET /api/v1/weather/forday/:date rechaza más de 7 días vista', async () => {
    const date = addDays(todayInMadrid(), 8);
    const res = await app.inject({ method: 'GET', url: `/api/v1/weather/forday/${date}` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('DATE_OUT_OF_RANGE');
  });

  it('GET /api/v1/weather/forday/:date con formato inválido devuelve 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/weather/forday/notadate' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_DATE');
  });

  // Golpea la red real de AEMET (dos peticiones: metadatos + descarga del
  // TAR de avisos) — requiere AEMET_API_KEY real. `npm test`/`npm run dev`
  // cargan `.env` si existe (ver `--env-file-if-exists` en package.json);
  // sin key configurada (p. ej. en CI), se prueba el camino degradado en su
  // lugar — nunca se salta la comprobación por completo.
  it.skipIf(!process.env.AEMET_API_KEY)(
    'GET /api/v1/weather/avisos devuelve los 9 fenómenos reales para la zona de Aranda',
    async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/weather/avisos' });
      expect(res.statusCode).toBe(200);
      const { data, meta } = res.json();
      expect(data.zonaCodigo).toBe('670904');
      expect(data.zona).toBe('Meseta de Burgos');
      expect(data.avisos.length).toBe(9);
      for (const aviso of data.avisos) {
        expect(['verde', 'amarillo', 'naranja', 'rojo']).toContain(aviso.nivel);
      }
      expect(typeof data.hayAvisosActivos).toBe('boolean');
      expect(meta.source).toContain('AEMET');
    },
    30_000,
  );

  it.skipIf(process.env.AEMET_API_KEY)(
    'GET /api/v1/weather/avisos sin AEMET_API_KEY configurada devuelve un error claro, no un 500',
    async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/weather/avisos' });
      expect(res.statusCode).toBe(502);
      expect(res.json().error.code).toBe('AVISOS_NOT_CONFIGURED');
    },
  );
});

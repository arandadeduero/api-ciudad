#!/usr/bin/env node
/**
 * Smoke test end-to-end contra una instancia real ya arrancada (no usa
 * fastify.inject). Pensado para ejecutarse:
 *   - en local, contra `npm run dev` / `npm start`
 *   - dentro de Docker, contra el contenedor levantado
 *
 * Uso: BASE_URL=http://localhost:3000 npm run smoke-test
 *
 * Se irá ampliando en cada fase con los endpoints nuevos que se vayan
 * implementando (ver docs/architecture-proposal.md §7 — plan de fases).
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const TIMEOUT_MS = 10_000;
/**
 * Río y embalse usan RIVER_TIMEOUT_MS/EMBALSE_TIMEOUT_MS = 60s cada uno, y
 * desde que los Client reintentan una vez ante un fallo transitorio
 * (`withSingleRetry`), el peor caso real es el doble de eso (~120.2s) antes
 * de que la propia API devuelva un error — este smoke test no debe hacer
 * timeout antes que ella. `/health/deep` y `/api/v1/meta/estado` comparten
 * `runSourceChecks` (src/diagnostics/sourceChecks.ts), que consulta en
 * paralelo ~12 fuentes reales, así que quedan acotadas por la más lenta de
 * todas — hoy, río/embalse — y necesitan el mismo margen.
 */
const SLOW_SOURCE_TIMEOUT_MS = 125_000;
const MAX_WAIT_MS = 30_000;

/** @type {{ name: string, path: string, expectStatus: number, timeoutMs?: number, validate?: (body: unknown) => boolean }[]} */
const CHECKS = [
  { name: 'health', path: '/health', expectStatus: 200 },
  { name: 'health/live', path: '/health/live', expectStatus: 200 },
  { name: 'health/ready', path: '/health/ready', expectStatus: 200 },
  {
    name: 'health/deep',
    path: '/health/deep',
    expectStatus: 200,
    timeoutMs: SLOW_SOURCE_TIMEOUT_MS,
  },
  {
    name: 'openapi spec',
    path: '/docs/json',
    expectStatus: 200,
    validate: (body) => typeof body === 'object' && body !== null && 'openapi' in body,
  },
  {
    name: 'farmacia',
    path: '/api/v1/farmacia',
    expectStatus: 200,
    validate: (body) => Array.isArray(body?.data) && body.data.length === 12,
  },
  {
    name: 'farmacia/hoy',
    path: '/api/v1/farmacia/hoy',
    expectStatus: 200,
    validate: (body) => typeof body?.data?.pharmacy?.name === 'string',
  },
  {
    name: 'farmacia/forday (fecha inválida -> 400)',
    path: '/api/v1/farmacia/forday/2026-02-30',
    expectStatus: 400,
    validate: (body) => body?.error?.code === 'INVALID_DATE',
  },
  {
    name: 'weather',
    path: '/api/v1/weather',
    expectStatus: 200,
    validate: (body) => typeof body?.data?.current?.temperature === 'number',
  },
  {
    name: 'ambiente',
    path: '/api/v1/ambiente',
    expectStatus: 200,
    validate: (body) => body?.data?.station?.name === 'Aranda de Duero 2',
  },
  {
    name: 'parking',
    path: '/api/v1/parking',
    expectStatus: 200,
    validate: (body) => Array.isArray(body?.data) && body.data.length > 0,
  },
  {
    name: 'parking/ora',
    path: '/api/v1/parking/ora',
    expectStatus: 200,
    validate: (body) => Array.isArray(body?.data?.districts) && body.data.districts.length === 6,
  },
  {
    name: 'residuos/puntolimpio',
    path: '/api/v1/residuos/puntolimpio',
    expectStatus: 200,
    validate: (body) => typeof body?.data?.direccion === 'string',
  },
  {
    name: 'residuos/atencion-ciudadana',
    path: '/api/v1/residuos/atencion-ciudadana',
    expectStatus: 200,
    validate: (body) => typeof body?.data?.telefono === 'string',
  },
  {
    name: 'bus/lines',
    path: '/api/v1/bus/lines',
    expectStatus: 200,
    validate: (body) => Array.isArray(body?.data) && body.data.length === 3,
  },
  {
    name: 'rio',
    path: '/api/v1/rio',
    expectStatus: 200,
    timeoutMs: SLOW_SOURCE_TIMEOUT_MS,
    validate: (body) => body?.data?.stationCode === 'EA013',
  },
  {
    name: 'rio/embalse',
    path: '/api/v1/rio/embalse',
    expectStatus: 200,
    timeoutMs: SLOW_SOURCE_TIMEOUT_MS,
    validate: (body) => body?.data?.stationCode === 'EM511',
  },
  {
    name: 'educacion/centros',
    path: '/api/v1/educacion/centros',
    expectStatus: 200,
    validate: (body) => Array.isArray(body?.data) && body.data.length === 27,
  },
  {
    name: 'bibliotecas',
    path: '/api/v1/bibliotecas',
    expectStatus: 200,
    validate: (body) => Array.isArray(body?.data) && body.data.length >= 1,
  },
  {
    name: 'meta/fuentes',
    path: '/api/v1/meta/fuentes',
    expectStatus: 200,
    validate: (body) => Array.isArray(body?.data) && body.data.some((s) => s.id === 'rio'),
  },
  {
    name: 'meta/estado',
    path: '/api/v1/meta/estado',
    expectStatus: 200,
    timeoutMs: SLOW_SOURCE_TIMEOUT_MS,
    validate: (body) => ['ok', 'degraded', 'down'].includes(body?.data?.status),
  },
];

/** Comprobación aparte: /metrics no devuelve JSON, así que no encaja en CHECKS. */
async function checkMetrics() {
  const res = await fetchWithTimeout(`${BASE_URL}/metrics`);
  const text = await res.text();
  return res.status === 200 && text.includes('http_requests_total');
}

/**
 * Comprobación aparte: /weather/avisos necesita AEMET_API_KEY, que puede o
 * no estar configurada en el entorno donde se ejecuta este smoke test (no
 * es una key pública como el resto de fuentes) — se acepta tanto el 200 con
 * datos reales como el 502 AVISOS_NOT_CONFIGURED, nunca un 500.
 */
async function checkAvisos() {
  const res = await fetchWithTimeout(`${BASE_URL}/api/v1/weather/avisos`);
  const body = await res.json().catch(() => undefined);
  if (res.status === 200) return Array.isArray(body?.data?.avisos) && body.data.avisos.length === 9;
  return res.status === 502 && body?.error?.code === 'AVISOS_NOT_CONFIGURED';
}

/**
 * Comprobación aparte: /docs sirve HTML, no JSON, y el fallo real que
 * detectó este bug (2026-09-09) es una cabecera CSP que bloquea el script
 * inline de arranque de Scalar en el navegador — un simple status 200 no lo
 * detecta, hay que mirar la cabecera y el propio HTML.
 */
async function checkDocs() {
  const res = await fetchWithTimeout(`${BASE_URL}/docs/`);
  const html = await res.text();
  const csp = res.headers.get('content-security-policy') ?? '';
  const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src '));
  return (
    res.status === 200 &&
    html.includes('Scalar.createApiReference') &&
    Boolean(scriptSrc?.includes('unsafe-inline'))
  );
}

async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function waitForServer() {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/health/live`);
      if (res.ok) return;
    } catch {
      // el servidor todavía no acepta conexiones, reintentar
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`El servidor no respondió en ${BASE_URL} tras ${MAX_WAIT_MS}ms`);
}

async function runChecks() {
  console.log('CITY API SMOKE TEST');
  console.log(`Target: ${BASE_URL}\n`);

  let passed = 0;
  const failures = [];

  for (const check of CHECKS) {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}${check.path}`, check.timeoutMs);
      const body = await res.json().catch(() => undefined);

      const statusOk = res.status === check.expectStatus;
      const bodyOk = check.validate ? check.validate(body) : true;

      if (statusOk && bodyOk) {
        console.log(`✓ ${check.name}`);
        passed += 1;
      } else {
        console.log(`✗ ${check.name} (status=${res.status}, expected=${check.expectStatus})`);
        failures.push(check.name);
      }
    } catch (err) {
      console.log(`✗ ${check.name} (error: ${err instanceof Error ? err.message : err})`);
      failures.push(check.name);
    }
  }

  try {
    if (await checkMetrics()) {
      console.log('✓ metrics');
      passed += 1;
    } else {
      console.log('✗ metrics');
      failures.push('metrics');
    }
  } catch (err) {
    console.log(`✗ metrics (error: ${err instanceof Error ? err.message : err})`);
    failures.push('metrics');
  }

  try {
    if (await checkDocs()) {
      console.log('✓ docs (Scalar UI + CSP script-src permite su script de arranque)');
      passed += 1;
    } else {
      console.log('✗ docs');
      failures.push('docs');
    }
  } catch (err) {
    console.log(`✗ docs (error: ${err instanceof Error ? err.message : err})`);
    failures.push('docs');
  }

  try {
    if (await checkAvisos()) {
      console.log('✓ weather/avisos (200 con datos reales, o 502 AVISOS_NOT_CONFIGURED sin key)');
      passed += 1;
    } else {
      console.log('✗ weather/avisos');
      failures.push('weather/avisos');
    }
  } catch (err) {
    console.log(`✗ weather/avisos (error: ${err instanceof Error ? err.message : err})`);
    failures.push('weather/avisos');
  }

  console.log(`\n${passed}/${CHECKS.length + 3} checks passed`);

  if (failures.length > 0) {
    console.log(`Fallos: ${failures.join(', ')}`);
    process.exit(1);
  }
}

waitForServer()
  .then(runChecks)
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

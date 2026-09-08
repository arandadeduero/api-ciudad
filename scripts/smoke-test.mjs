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
const MAX_WAIT_MS = 30_000;

/** @type {{ name: string, path: string, expectStatus: number, validate?: (body: unknown) => boolean }[]} */
const CHECKS = [
  { name: 'health', path: '/health', expectStatus: 200 },
  { name: 'health/live', path: '/health/live', expectStatus: 200 },
  { name: 'health/ready', path: '/health/ready', expectStatus: 200 },
  { name: 'health/deep', path: '/health/deep', expectStatus: 200 },
  {
    name: 'openapi spec',
    path: '/docs/json',
    expectStatus: 200,
    validate: (body) => typeof body === 'object' && body !== null && 'openapi' in body,
  },
];

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
      const res = await fetchWithTimeout(`${BASE_URL}${check.path}`);
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

  console.log(`\n${passed}/${CHECKS.length} checks passed`);

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

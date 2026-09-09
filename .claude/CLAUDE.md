# API Ciudad de Aranda de Duero — operating notes for Claude

Read this first in every session on this repo. It's a distillation of
hard-won decisions and recurring bugs, not a tutorial — full detail always
lives in the docs linked below, and this file must never drift from them.

## What this project is

A production-grade REST API aggregating real municipal/regional/national
open data for Aranda de Duero (Burgos, Spain), under `/api/v1`. Built
phase-by-phase with explicit user approval at each phase. **Never invent
data or APIs** — every module is backed by a verified real source, or is
explicitly excluded as a decision (not a TODO). This principle has already
caught real errors (see "Hard-won lessons" below) — always verify a claim
against the primary source (legal text, official PDF, live API) before
trusting an earlier investigation, including your own.

## Current state (2026-09-09)

Phases 1-7 complete (all planned data modules + observability + a source
expansion from a dedicated research pass), plus a robustness/documentation
pass. Phase 8 (extra E2E, CI/CD hardening) is the only thing left. ~205
tests passing. Full status/history:
[`docs/architecture-proposal.md`](../docs/architecture-proposal.md) §7,
[`ARCHITECTURE.md`](../ARCHITECTURE.md).

Modules live: `/farmacia`, `/weather` (+ `/weather/avisos`, AEMET),
`/ambiente`, `/parking`, `/residuos`, `/bus`, `/rio` (+ `/rio/embalse`),
`/educacion`, `/bibliotecas`, `/meta/{fuentes,estado}`, plus `/health*` and
`/metrics` at root. `eventos` and `cortescalles` (Waze) are **excluded from
v1 by decision** — do not treat them as missing work.

`weather/avisos` needs a real `AEMET_API_KEY` (free, requested by email) to
return live data — without one it degrades to a clear `AVISOS_NOT_CONFIGURED`
error rather than breaking anything else. `/health/deep` and `/meta/estado`
report it as `"degraded"` (not `"error"`) when unconfigured — that is an
intentional distinction, not a bug in the check.

## Stack

Node 24 LTS (Active LTS — Node 26 stays "Current" until Oct 2026, so don't
bump the base image without checking that again), TypeScript strict + ESM
(`NodeNext`, `.js` extensions in relative imports), Fastify 5, Zod, Pino,
Vitest 5, Docker multi-stage, GitHub Actions CI.

## Architecture (see `ARCHITECTURE.md` for the full map)

```
Client/Repository (external HTTP or local dataset)
  → Adapter (normalizes to domain model)
  → Service (business rules, caching, resilience)
  → CacheService (memory now, Redis later)
  → Route (JSON Schema validation, {data, meta} envelope)
  → REST API /api/v1
```

Services depend on provider **interfaces**, never concrete client classes
(enables test doubles without network). Response envelope is fixed:
success `{ data, meta: { source, retrievedAt, cached, stale? } }`, error
`{ error: { code, message, requestId } }`.

## Non-negotiable verification sequence

Before every commit, in this order:

1. `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`
2. Manual `curl` against a real running server (`node dist/server.js`) for
   anything touched — don't trust tests alone for schema/serialization bugs.
3. Full Docker cycle: `docker build`, `docker run`, then
   `BASE_URL=http://localhost:PORT npm run smoke-test`, then clean up the
   test container/image.

This isn't optional ceremony — it's caught real bugs every phase (see below).

## Hard-won lessons (don't relearn these)

1. **Fastify `response` schema is a serialization whitelist.** Any property
   not declared gets silently dropped — including `meta`, or every field of
   an array item declared as `{ type: 'object' }` with no `properties`. Hit
   twice (Phase 2, Phase 4) before becoming a review habit. Always wrap
   `data` with `responseSchema()` (`src/routes/schemas.ts`), and after
   adding/changing a schema, **verify the real JSON response with curl**,
   field by field — don't just trust the tests. A later audit also found 7
   routes with **no `response` schema at all** (`residuos/*`, `parking/ora`,
   `bus/stop/:id/next`) — periodically check every route declares one, not
   just the ones that already have one.
2. **`z.coerce.boolean()` is wrong for env flags.** `Boolean("false")` is
   `true` in JS, so it would treat `MATOMO_ENABLED=false` as enabled. Use
   `z.enum(['true','false']).transform(v => v === 'true')` instead.
3. **Runtime disk writes need `COPY --chown` in the Dockerfile** (e.g. the
   GTFS cache) or they fail silently as the non-root `apiciudad` user —
   verify by exec'ing into the real container, not just a successful build.
4. **Third-party free APIs (e.g. the río SAIH proxy on Heroku) fail
   transiently for real**, including mid-test-run. That's the documented
   "media" reliability, not a bug — retry once, and if it passes, it was
   transient; don't chase it as a regression.
5. **Verify against the primary source, not a secondary one**, before
   shipping a data claim — this project has corrected itself multiple times
   (JCyL station existence, ORA hours/district count, farmacias guardia
   dates, residuos operator) after checking the actual legal text/PDF/API
   instead of a derived or remembered version.
6. A route can exist at the **Service** layer with real, validated data and
   never get wired to an HTTP route — this happened with
   `residuos/atencion-ciudadana` from Phase 3 to the robustness pass. When
   auditing a module, check Service methods against Route registrations,
   not just Route registrations against docs.
7. **`app.inject()` (used by every E2E test here) never executes JavaScript**,
   so it can't catch a page that returns 200 but never renders in a real
   browser. Swagger UI's init script was an inline `<script>`, silently
   blocked by Helmet's default CSP (`script-src 'self'`, no
   `'unsafe-inline'`/nonce) — only caught when a human loaded `/docs` for
   real. Fixed by switching `/docs` to Scalar and scoping `script-src
'unsafe-inline'` to that one path only in `src/plugins/security.ts`
   (everything else keeps the strict default). If you touch anything that
   renders HTML with inline `<script>`/`<style>`, check the CSP header with
   curl — don't assume `app.inject()` returning 200 means it works.
8. **`node`/`tsx` don't load `.env` on their own.** No script in this repo
   did until Phase 7 — invisible until a real secret (`AEMET_API_KEY`) was
   needed, since every earlier source was keyless. Fixed with Node's native
   `--env-file-if-exists=.env` flag (≥20.12, no `dotenv` dependency) in
   `dev`/`start`/`test`/`test:watch`/`test:e2e`/`test:coverage` — it's a
   no-op without a `.env` file, so Docker/CI (real env vars, no file) are
   unaffected. If a locally-set env var seems to have no effect, check
   whether the script you're running actually loads `.env` before assuming
   the code is broken.
9. **When scraping HTML for a value an API doesn't expose, cross-check
   against the API first if one partially covers the same data.** The
   embalse's water-level API (already used for the river) and the HTML
   ficha it was scraped from agreed on the exact same number live — that
   agreement is what justified trusting the scrape for the fields the API
   doesn't have (`%` filled), rather than a hand-wave "the page looked
   right."

## Documentation is part of the change, not a follow-up

[`docs/API-REFERENCE.md`](../docs/API-REFERENCE.md) is the authoritative
per-endpoint reference (real examples, every error code) — **any route
change (new/modified/removed) updates it in the same commit**, per its own
"Cómo mantener este documento" section. `API.md`, `ARCHITECTURE.md`,
`DATA-SOURCES.md`, `README.md`, `.env.example` get the same treatment for
changes that affect them. Every route also carries OpenAPI `summary`,
`description`, and parameter `description` fields — `/docs` (Scalar)
should explain behavior, not just list types.

## Where things are

- [`docs/architecture-proposal.md`](../docs/architecture-proposal.md) —
  canonical research/decisions doc, phase history in §7.
- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — implemented architecture,
  numbered principles (read before touching cache/errors/routes).
- [`docs/API-REFERENCE.md`](../docs/API-REFERENCE.md) — full endpoint
  reference with real payloads.
- [`API.md`](../API.md) — one-line-per-endpoint summary.
- [`DATA-SOURCES.md`](../DATA-SOURCES.md) — source catalog and status.
- [`DEVELOPMENT.md`](../DEVELOPMENT.md) / [`DEPLOYMENT.md`](../DEPLOYMENT.md)
  — local dev and deploy/env-var guides.

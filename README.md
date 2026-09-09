# API Ciudad de Aranda de Duero

Capa de agregación de datos abiertos municipales, regionales y estatales de
Aranda de Duero (Burgos, España): meteorología, calidad del aire, farmacias
de guardia, aparcamiento, transporte, río y más, expuestos como una única
API REST versionada.

> **Estado actual: v1 completa (Fases 1-6).** `/api/v1/farmacia*`,
> `/api/v1/weather*`, `/api/v1/ambiente*`, `/api/v1/parking*`,
> `/api/v1/residuos*`, `/api/v1/bus*` y `/api/v1/rio*` funcionan con datos
> y APIs reales — ver [`docs/API-REFERENCE.md`](docs/API-REFERENCE.md)
> para el detalle completo de cada endpoint. `/eventos` y cortes de calles
> quedan fuera de la v1 por decisión explícita (ver
> [`docs/architecture-proposal.md`](docs/architecture-proposal.md) §6).
> Observabilidad (Fase 6) añadida: métricas Prometheus en `GET /metrics`,
> tracking best-effort con Matomo, y endpoints de transparencia
> `GET /api/v1/meta/fuentes` / `GET /api/v1/meta/estado`. Solo queda
> pendiente la Fase 7 (E2E adicional, CI/CD, hardening).

## Requisitos

- Node.js **24 LTS** (`engines` en `package.json`). Es la LTS activa a fecha
  de este proyecto — Node 26 es "Current" pero entra en LTS en octubre 2026,
  así que no se fija como base todavía.
- npm 10+

## Puesta en marcha

```bash
git clone <repo>
cd api-ciudad
npm install
cp .env.example .env
npm run dev
```

La API queda disponible en:

- `http://localhost:3000/health`
- `http://localhost:3000/docs` (Swagger UI)
- `http://localhost:3000/docs/json` (spec OpenAPI)

## Docker

```bash
docker compose up --build
```

Redis es opcional (solo necesario si `CACHE_DRIVER=redis`):

```bash
docker compose --profile redis up --build
```

## Tests

```bash
npm test              # unit + integración + e2e (algunos e2e golpean red real: Open-Meteo, JCyL, GitHub, API del río)
npm run test:e2e       # solo e2e
npm run test:coverage
```

## Smoke test (contra una instancia real ya arrancada)

```bash
npm run dev &
npm run smoke-test
```

O contra el contenedor Docker:

```bash
docker compose up -d --build
BASE_URL=http://localhost:3000 npm run smoke-test
```

## Documentación

- [`docs/architecture-proposal.md`](docs/architecture-proposal.md) — investigación de fuentes, arquitectura propuesta y decisiones (documento canónico).
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — resumen de la arquitectura implementada.
- [`DATA-SOURCES.md`](DATA-SOURCES.md) — catálogo de fuentes externas y su estado.
- [`DEVELOPMENT.md`](DEVELOPMENT.md) — guía de desarrollo local.
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — despliegue y variables de entorno.
- [`API.md`](API.md) — endpoints implementados, resumen de una línea.
- [`docs/API-REFERENCE.md`](docs/API-REFERENCE.md) — referencia completa de cada endpoint (parámetros, ejemplos reales, todos los códigos de error). Documento interno autoritativo, se actualiza en el mismo commit que cualquier cambio de API.

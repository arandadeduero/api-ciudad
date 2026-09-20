# API Ciudad de Aranda de Duero

Capa de agregación de datos abiertos municipales, regionales y estatales de
Aranda de Duero (Burgos, España): meteorología, calidad del aire, farmacias
de guardia, aparcamiento, transporte, río y más, expuestos como una única
API REST versionada.

> **Estado actual: v1 completa (Fases 1-7).** `/api/v1/farmacia*`,
> `/api/v1/weather*`, `/api/v1/ambiente*`, `/api/v1/parking*`,
> `/api/v1/residuos*`, `/api/v1/bus*`, `/api/v1/rio*`,
> `/api/v1/educacion*` y `/api/v1/bibliotecas` funcionan con datos y APIs
> reales — ver [`docs/API-REFERENCE.md`](docs/API-REFERENCE.md) para el
> detalle completo de cada endpoint. `/eventos` y cortes de calles quedan
> fuera de la v1 por decisión explícita (ver
> [`docs/architecture-proposal.md`](docs/architecture-proposal.md) §6).
> Observabilidad (Fase 6): métricas Prometheus en `GET /metrics`, tracking
> best-effort con Matomo, y endpoints de transparencia
> `GET /api/v1/meta/fuentes` / `GET /api/v1/meta/estado`. Fase 7 amplió el
> catálogo con `GET /api/v1/rio/embalse`, `GET /api/v1/weather/avisos`
> (AEMET, requiere `AEMET_API_KEY` gratuita) y educación/bibliotecas (JCyL).
> Solo queda pendiente la Fase 8 (E2E adicional, CI/CD, hardening).

## Módulos

| Módulo                  | Base                            | Fuente                                          |
| ----------------------- | ------------------------------- | ----------------------------------------------- |
| Farmacias de guardia    | `/api/v1/farmacia*`             | Colegio Of. Farmacéuticos de Burgos             |
| Meteorología + avisos   | `/api/v1/weather*`              | Open-Meteo + AEMET (`avisos`, requiere API key) |
| Calidad del aire        | `/api/v1/ambiente*`             | JCyL — Datos Abiertos                           |
| Aparcamiento / ORA      | `/api/v1/parking*`              | Ordenanza municipal (BOP Burgos 245/2021)       |
| Residuos y punto limpio | `/api/v1/residuos*`             | Ayuntamiento de Aranda de Duero                 |
| Bus urbano              | `/api/v1/bus*`                  | GTFS real (`arandadeduero/gtfs-busurbano`)      |
| Río + embalse           | `/api/v1/rio*`                  | SAIH-CHD (API de terceros) + SAIH del Duero     |
| Educación               | `/api/v1/educacion*`            | JCyL — directorio de centros docentes           |
| Bibliotecas             | `/api/v1/bibliotecas`           | JCyL — directorio de bibliotecas                |
| Transparencia           | `/api/v1/meta/*`                | Interno (catálogo de fuentes + estado en vivo)  |
| Infraestructura         | `/health*`, `/metrics`, `/docs` | Interno                                         |

Detalle completo de parámetros, ejemplos reales y códigos de error en
[`docs/API-REFERENCE.md`](docs/API-REFERENCE.md); resumen de una línea por
endpoint en [`API.md`](API.md).

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

Todos los módulos funcionan con la configuración por defecto salvo
`GET /api/v1/weather/avisos` (AEMET): pide una `AEMET_API_KEY` gratuita en
https://opendata.aemet.es y añádela a tu `.env` — sin ella, ese endpoint
responde con un error claro (`AVISOS_NOT_CONFIGURED`) en vez de romper el
arranque del resto de la API. `npm run dev` carga `.env` automáticamente
si existe (ver [Tests](#tests) más abajo).

La API queda disponible en:

- `http://localhost:3000/health`
- `http://localhost:3000/docs` (Scalar — referencia interactiva de la API)
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
npm test              # unit + integración + e2e (algunos e2e golpean red real: Open-Meteo, JCyL, GitHub, API del río, AEMET, SAIH Duero)
npm run test:e2e       # solo e2e
npm run test:coverage
```

`npm test`/`npm run dev`/`npm start` cargan `.env` automáticamente si existe
(`--env-file-if-exists`, nativo de Node ≥20.12 — sin `.env`, como en
CI/Docker, no falla, simplemente no hay nada que cargar). El test de
`GET /api/v1/weather/avisos` necesita `AEMET_API_KEY` real en `.env` para
probar el camino con datos; sin ella, prueba en su lugar que el endpoint
responde con el error `AVISOS_NOT_CONFIGURED`, nunca con un 500.

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

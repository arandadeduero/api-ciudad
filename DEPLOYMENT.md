# Despliegue

## Docker (recomendado)

```bash
cp .env.example .env   # ajustar valores de producción
docker compose up --build -d
```

La imagen (`Dockerfile`) es multi-stage, corre como usuario no root
(`apiciudad`), y expone un `HEALTHCHECK` sobre `/health/live`.

Redis es opcional y no se levanta por defecto:

```bash
docker compose --profile redis up --build -d
```

## Variables de entorno

Ver [`.env.example`](.env.example) para el listado completo y comentado.
Resumen de las que son obligatorias ahora mismo (fail-fast al arrancar si
faltan o son inválidas):

| Variable            | Default       | Descripción                                           |
| ------------------- | ------------- | ----------------------------------------------------- |
| `NODE_ENV`          | `development` | `development` \| `test` \| `production`               |
| `PORT`              | `3000`        | Puerto HTTP                                           |
| `LOG_LEVEL`         | `info`        | Nivel de log de Pino                                  |
| `CORS_ORIGIN`       | `*`           | `*` o lista separada por comas de orígenes permitidos |
| `RATE_LIMIT_MAX`    | `100`         | Peticiones máximas por ventana                        |
| `RATE_LIMIT_WINDOW` | `1 minute`    | Ventana de rate limit                                 |
| `CACHE_DRIVER`      | `memory`      | `memory` (único driver implementado hoy)              |

El resto de variables de fuentes externas están documentadas en
`.env.example` con sus valores por defecto reales (`OPEN_METEO_BASE_URL`,
`JCYL_OPENDATA_BASE_URL`, `GTFS_URBANO_REPO`, `RIVER_API_BASE_URL`, etc.) y
ya se usan en producción desde sus fases respectivas (2-5, ver
`docs/architecture-proposal.md` §7). Dos excepciones siguen sin consumirse
por decisión explícita, no por estar pendientes:

- `AEMET_API_KEY` / `AEMET_BASE_URL` — Open-Meteo cubre `/weather`; AEMET
  queda como alternativa no activada.
- `WAZE_*` — el módulo de cortes de calles está fuera de la v1 (§6).

`MATOMO_*` (Fase 6) sí se lee al arrancar, pero es opcional de verdad:
con `MATOMO_ENABLED=false` (el default) el `MatomoService` no hace ninguna
llamada de red — la API funciona igual con o sin Matomo configurado.

## Verificar el despliegue

```bash
curl http://<host>:3000/health
curl http://<host>:3000/health/ready
curl http://<host>:3000/metrics
BASE_URL=http://<host>:3000 npm run smoke-test
```

## CI/CD

`.github/workflows/ci.yml` ejecuta en cada push/PR: install → lint → format
check → typecheck → tests → build → build de la imagen Docker → smoke test
contra el contenedor real. Un fallo en cualquier paso bloquea el merge.

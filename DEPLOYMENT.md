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

Las variables de fuentes externas (`OPEN_METEO_BASE_URL`, `AEMET_API_KEY`,
`JCYL_OPENDATA_BASE_URL`, `GTFS_*`, `WAZE_*`, `RIVER_API_BASE_URL`,
`MATOMO_*`) están documentadas en `.env.example` pero **no se usan
todavía** — se activarán en las fases 2-6 (ver
`docs/architecture-proposal.md` §7).

## Verificar el despliegue

```bash
curl http://<host>:3000/health
curl http://<host>:3000/health/ready
BASE_URL=http://<host>:3000 npm run smoke-test
```

## CI/CD

`.github/workflows/ci.yml` ejecuta en cada push/PR: install → lint → format
check → typecheck → tests → build → build de la imagen Docker → smoke test
contra el contenedor real. Un fallo en cualquier paso bloquea el merge.

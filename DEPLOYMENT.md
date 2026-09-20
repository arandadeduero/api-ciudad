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

### Usar la imagen publicada (sin clonar el repo)

Cada push a `main` que pase el CI publica la imagen en GitHub Container
Registry (`ghcr.io/arandadeduero/api-ciudad`, etiquetas `latest` y el sha
corto del commit — ver [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
[`docker-compose.example.yml`](docker-compose.example.yml) es el ejemplo
mínimo para arrancarla directamente:

```bash
cp .env.example .env   # opcional: rellena AEMET_API_KEY para avisos reales
docker compose -f docker-compose.example.yml up -d
```

La imagen nunca incluye `.env` ni ningún secreto — el `Dockerfile` no lo
copia (`.dockerignore`), las variables llegan por el entorno del contenedor
en tiempo de ejecución. Aun así, **no subas tu propio `.env`** a ningún
sitio si lo has rellenado con claves reales.

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
`JCYL_OPENDATA_BASE_URL`, `GTFS_URBANO_REPO`, `RIVER_API_BASE_URL`,
`SAIH_DUERO_BASE_URL`, `EDUCACION_*`, `BIBLIOTECAS_*`, etc.) y ya se usan en
producción desde sus fases respectivas (2-7, ver
`docs/architecture-proposal.md` §7). Una única excepción sigue sin
consumirse por decisión explícita, no por estar pendiente:

- `WAZE_*` — el módulo de cortes de calles está fuera de la v1 (§6).

**`AEMET_API_KEY`** (Fase 7) sí se consume, para `GET /api/v1/weather/avisos`
— clave gratuita, pedida por email en https://opendata.aemet.es. Sin ella
configurada, ese único endpoint responde con el error `AVISOS_NOT_CONFIGURED`
(no un 500); el resto de la API funciona exactamente igual. **Importante:**
las keys de AEMET sin fecha de expiración dejan de ser válidas desde el
15-oct-2026 — pide una nueva si la actual falla después de esa fecha.

`MATOMO_*` (Fase 6) es igual de opcional: con `MATOMO_ENABLED=false` (el
default) el `MatomoService` no hace ninguna llamada de red.

En local, `npm start`/`npm run dev` cargan `.env` automáticamente si existe
(flag nativo `--env-file-if-exists` de Node, sin dependencia `dotenv`). En
Docker/producción esto no aplica — no hay `.env` en la imagen; las variables
llegan por el entorno real del contenedor (`docker run -e ...`,
`docker-compose.yml`, o el orquestador que corresponda).

## Verificar el despliegue

```bash
curl http://<host>:3000/health
curl http://<host>:3000/health/ready
curl http://<host>:3000/metrics
curl http://<host>:3000/api/v1/weather/avisos   # 200 con datos, o 502 AVISOS_NOT_CONFIGURED sin AEMET_API_KEY
BASE_URL=http://<host>:3000 npm run smoke-test
```

## CI/CD

`.github/workflows/ci.yml` ejecuta en cada push/PR: install → lint → format
check → typecheck → tests → build → build de la imagen Docker → smoke test
contra el contenedor real. Un fallo en cualquier paso bloquea el merge.

Solo en push a `main` (nunca en PRs), y solo si lo anterior pasa, un segundo
job (`publish`) reconstruye la imagen y la publica en GitHub Container
Registry con `docker/build-push-action`, usando el `GITHUB_TOKEN` propio del
workflow (permiso `packages: write`, sin secretos adicionales que
configurar).

**Importante — visibilidad del paquete:** GHCR crea los paquetes en
**privado** por defecto, sin importar que el repositorio sea público — no
hay forma de automatizarlo por API (confirmado contra la documentación
oficial de GitHub). Tras la primera publicación hace falta un paso manual
único e irreversible: en la página del paquete
(`github.com/arandadeduero/api-ciudad/pkgs/container/api-ciudad`) → **Package
settings** → **Danger Zone** → **Change visibility** → **Public**.

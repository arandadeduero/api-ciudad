# API — endpoints implementados

La fuente de verdad siempre es `/docs` (Swagger UI) y `/docs/json` (spec
OpenAPI), generados desde el código. Este fichero es un resumen manual para
lectura rápida, y se actualiza en cada fase.

## Estado: Fase 2

### Infraestructura (Fase 1)

| Método | Ruta            | Descripción                                                                                                                                                                                                                           |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`       | Estado general: `{ status, version, uptime }`                                                                                                                                                                                         |
| GET    | `/health/live`  | Liveness probe                                                                                                                                                                                                                        |
| GET    | `/health/ready` | Readiness probe (dependencias críticas — cache)                                                                                                                                                                                       |
| GET    | `/health/deep`  | Diagnóstico por módulo: `ok`/`degraded`/`error` para farmacia y weather (ya implementados y comprobados de verdad), `not_implemented` para ambiente/parking/bus/rio, `excluded` para eventos/cortescalles (fuera de alcance de la v1) |
| GET    | `/docs`         | Swagger UI                                                                                                                                                                                                                            |
| GET    | `/docs/json`    | Spec OpenAPI 3                                                                                                                                                                                                                        |

### Farmacia (`/api/v1/farmacia`)

Datos reales del Colegio Oficial de Farmacéuticos de Burgos (ver
`DATA-SOURCES.md`), no un fixture.

| Método | Ruta                                | Descripción                                                                                                  |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/v1/farmacia`                  | Catálogo de las 12 farmacias                                                                                 |
| GET    | `/api/v1/farmacia/hoy`              | Farmacia de guardia hoy (zona horaria Europe/Madrid)                                                         |
| GET    | `/api/v1/farmacia/forday/:date`     | Guardia para una fecha `YYYY-MM-DD`. 400 si la fecha no es válida, 404 si el año no tiene calendario cargado |
| GET    | `/api/v1/farmacia/formonth/:month`  | Guardias de un mes `YYYY-MM` completo                                                                        |
| GET    | `/api/v1/farmacia/dashboard?days=5` | Hoy + próximos N días (1-14), pensado para UI/kiosco                                                         |

Cada guardia incluye `holiday` (festivo nacional/autonómico si aplica, o
`null`) y `lowConfidence` (`true` para las 14 fechas documentadas como de
confianza más baja, ver `data/farmacias-guardia-2026.json`).

### Weather (`/api/v1/weather`)

Fuente: Open-Meteo (sin API key). Cache 10 min con fallback a caché
obsoleta si Open-Meteo falla (`meta.stale: true`).

| Método | Ruta                           | Descripción                                                              |
| ------ | ------------------------------ | ------------------------------------------------------------------------ |
| GET    | `/api/v1/weather`              | Tiempo actual + previsión horaria de hoy                                 |
| GET    | `/api/v1/weather/hoy`          | Alias de `/weather`                                                      |
| GET    | `/api/v1/weather/forday/:date` | Previsión horaria para un día futuro. 400 si la fecha no es hoy..+7 días |

## Formato de respuesta

Éxito:

```json
{ "data": {}, "meta": { "source": "...", "retrievedAt": "...", "cached": false } }
```

Con fallback a caché obsoleta, `meta` añade `"stale": true`.

Error:

```json
{ "error": { "code": "INVALID_DATE", "message": "...", "requestId": "..." } }
```

(Los endpoints de `/health` no siguen el envoltorio `data`/`meta` por
convención estándar de health checks; sí siguen el formato de error común.)

## Pendiente (fases 3+)

`ambiente`, `parking`, `bus`, `rio` — ver plan de fases en
`docs/architecture-proposal.md` §7. `eventos` y `cortescalles` quedan
excluidos de la v1 por decisión del usuario.

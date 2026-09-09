# API — endpoints implementados

Resumen de una línea por endpoint. **Para el detalle completo (parámetros,
ejemplos de payload reales, todos los códigos de error)**, ver
[`docs/API-REFERENCE.md`](docs/API-REFERENCE.md) — documento interno
autoritativo, se actualiza en el mismo commit que cualquier cambio de API.
`/docs` (Swagger UI) es la fuente ejecutable/interactiva generada desde el
código.

## Estado: Fase 6 (v1 completa salvo eventos/cortes de calles, excluidos por decisión; observabilidad añadida)

### Infraestructura (Fase 1 y Fase 6)

| Método | Ruta            | Descripción                                                                                                          |
| ------ | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`       | Estado general: `{ status, version, uptime }`                                                                        |
| GET    | `/health/live`  | Liveness probe                                                                                                       |
| GET    | `/health/ready` | Readiness probe (dependencias críticas — cache)                                                                      |
| GET    | `/health/deep`  | Diagnóstico por módulo: `ok`/`degraded`/`error` para los módulos implementados, `excluded` para eventos/cortescalles |
| GET    | `/metrics`      | Métricas Prometheus (Fase 6)                                                                                         |
| GET    | `/docs`         | Swagger UI                                                                                                           |
| GET    | `/docs/json`    | Spec OpenAPI 3                                                                                                       |

### Farmacia (`/api/v1/farmacia`) — Fase 2

Datos reales del Colegio Oficial de Farmacéuticos de Burgos.

| Método | Ruta                                | Descripción                                          |
| ------ | ----------------------------------- | ---------------------------------------------------- |
| GET    | `/api/v1/farmacia`                  | Catálogo de las 12 farmacias                         |
| GET    | `/api/v1/farmacia/hoy`              | Farmacia de guardia hoy                              |
| GET    | `/api/v1/farmacia/forday/:date`     | Guardia para una fecha `YYYY-MM-DD`                  |
| GET    | `/api/v1/farmacia/formonth/:month`  | Guardias de un mes `YYYY-MM` completo                |
| GET    | `/api/v1/farmacia/dashboard?days=5` | Hoy + próximos N días (1-14), pensado para UI/kiosco |

### Weather (`/api/v1/weather`) — Fase 2

Fuente: Open-Meteo (sin API key).

| Método | Ruta                           | Descripción                                              |
| ------ | ------------------------------ | -------------------------------------------------------- |
| GET    | `/api/v1/weather`              | Tiempo actual + previsión horaria de hoy                 |
| GET    | `/api/v1/weather/hoy`          | Alias de `/weather`                                      |
| GET    | `/api/v1/weather/forday/:date` | Previsión horaria para un día futuro (máx. 7 días vista) |

### Ambiente (`/api/v1/ambiente`) — Fase 3

Fuente: JCyL — Datos Abiertos. Estación real "Aranda de Duero 2".

| Método | Ruta                            | Descripción                                                        |
| ------ | ------------------------------- | ------------------------------------------------------------------ |
| GET    | `/api/v1/ambiente`              | Calidad del aire de hoy (horaria)                                  |
| GET    | `/api/v1/ambiente/hoy`          | Alias de `/ambiente`                                               |
| GET    | `/api/v1/ambiente/forday/:date` | Hoy: horario. Fecha pasada: agregado diario del histórico validado |

### Parking (`/api/v1/parking`) — Fase 3

Fuente: Ordenanza ORA (BOP Burgos 245/2021, texto legal oficial).

| Método | Ruta                            | Descripción                                               |
| ------ | ------------------------------- | --------------------------------------------------------- |
| GET    | `/api/v1/parking`               | Aparcamientos públicos                                    |
| GET    | `/api/v1/parking/:id`           | Detalle de un aparcamiento                                |
| GET    | `/api/v1/parking/ora`           | Horario, duración, exenciones y los 6 distritos ORA (A-F) |
| GET    | `/api/v1/parking/ora/:district` | Calles de un distrito concreto                            |

### Residuos (`/api/v1/residuos`) — Fase 3

Fuente: 2 PDF oficiales del Ayuntamiento (Medio Ambiente / Aseo Urbano).

| Método | Ruta                                  | Descripción                          |
| ------ | ------------------------------------- | ------------------------------------ |
| GET    | `/api/v1/residuos/puntolimpio`        | Horario y ubicación del Punto Limpio |
| GET    | `/api/v1/residuos/contenedores`       | Los 9 tipos de contenedor            |
| GET    | `/api/v1/residuos/contenedores/:tipo` | Detalle de un tipo                   |
| GET    | `/api/v1/residuos/enseres`            | Recogida de muebles (Valoriza)       |
| GET    | `/api/v1/residuos/comercio-carton`    | Recogida de cartón comercial         |

### Bus (`/api/v1/bus`) — Fase 4

Fuente: GTFS real del bus urbano (github.com/arandadeduero/gtfs-busurbano).

| Método | Ruta                               | Descripción                                                               |
| ------ | ---------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/api/v1/bus`                      | Resumen: líneas + número de paradas                                       |
| GET    | `/api/v1/bus/lines`                | Las 3 líneas (L1, L2, L3)                                                 |
| GET    | `/api/v1/bus/lines/:line`          | Detalle de una línea                                                      |
| GET    | `/api/v1/bus/stops`                | Las 44 paradas reales                                                     |
| GET    | `/api/v1/bus/stops/:id`            | Detalle de una parada                                                     |
| GET    | `/api/v1/bus/nearest?lat=&lon=`    | Parada más cercana a unas coordenadas                                     |
| GET    | `/api/v1/bus/stop/:id/next?count=` | Próximos autobuses en una parada (cálculo real contra el calendario GTFS) |

### Río (`/api/v1/rio`) — Fase 5

Fuente: API de terceros sobre datos SAIH-CHD (no es la API oficial de la CHD).

| Método | Ruta                        | Descripción                                                 |
| ------ | --------------------------- | ----------------------------------------------------------- |
| GET    | `/api/v1/rio`               | Resumen: último nivel y caudal, con tendencia               |
| GET    | `/api/v1/rio/nivel?hours=`  | Serie de nivel (m), últimas N horas (1-720, por defecto 24) |
| GET    | `/api/v1/rio/caudal?hours=` | Serie de caudal (m³/s), últimas N horas                     |

### Meta (`/api/v1/meta`) — Fase 6

Endpoints de transparencia, no de dominio: metadatos sobre la propia API.

| Método | Ruta                   | Descripción                                                           |
| ------ | ---------------------- | --------------------------------------------------------------------- |
| GET    | `/api/v1/meta/fuentes` | Catálogo de todas las fuentes: procedencia, licencia, fiabilidad      |
| GET    | `/api/v1/meta/estado`  | Estado en vivo agregado de cada fuente (equivalente a `/health/deep`) |

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

## Pendiente

Fase 7 (E2E adicional, CI/CD, hardening) — ver plan de fases en
`docs/architecture-proposal.md` §7. `eventos` y `cortescalles` quedan
excluidos de la v1 por decisión del usuario; no hay más módulos de dominio
pendientes.

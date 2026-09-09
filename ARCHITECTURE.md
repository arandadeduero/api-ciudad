# Arquitectura

Documento de referencia rápida sobre lo **ya implementado**. Para la
investigación de fuentes, el razonamiento completo y las decisiones
descartadas, ver el documento canónico:
[`docs/architecture-proposal.md`](docs/architecture-proposal.md).

## Capas

```text
Client / Repository (proveedor externo o dataset local)
   ↓
Adapter (normaliza al modelo de dominio propio)
   ↓
Service (reglas de negocio, TTL, fallback)
   ↓
Cache (CacheService — memoria por defecto, Redis cuando haga falta)
   ↓
Route (validación JSON Schema, envoltorio {data, meta}, mapeo HTTP)
   ↓
REST API /api/v1
```

`Client` es para proveedores HTTP externos (p. ej. `OpenMeteoClient`);
`Repository` es el equivalente para datasets locales estáticos (p. ej.
`FarmaciaRepository`, que lee y valida los ficheros de `data/`) — mismo
rol arquitectónico, nombre distinto porque no hay red de por medio.

## Infraestructura común (Fase 1)

- `src/config/env.ts` — validación de variables de entorno con Zod, fail-fast.
- `src/errors/` — `AppError` tipado + error handler central (`{ error: { code, message, requestId } }`).
- `src/cache/` — `CacheService` (interfaz) + `InMemoryCache` (implementación activa).
- `src/plugins/security.ts` — Helmet, CORS, rate limiting. El CSP de Helmet relaja `script-src` a `'unsafe-inline'` solo para `/docs` (necesario para el script de arranque de Scalar, ver más abajo); el resto de la API mantiene `script-src 'self'` sin excepciones.
- `src/plugins/openapi.ts` — OpenAPI 3 + Scalar (`@scalar/fastify-api-reference`) en `/docs`. Reemplazó a Swagger UI (2026-09-09): Swagger UI generaba un `<script>` de inicialización inline que el CSP por defecto bloqueaba en el navegador (comprobado en vivo — la página cargaba con 200 pero no se renderizaba). Scalar sirve su JS desde un fichero propio del mismo origen (`/docs/js/scalar.js`), pero también necesita un pequeño script inline para arrancar, de ahí el ajuste de CSP en `security.ts`.
- `src/routes/schemas.ts` — piezas de JSON Schema compartidas (`responseSchema`, envoltorio `{data, meta}`).
- `src/routes/health.ts` — `/health`, `/health/live`, `/health/ready`, `/health/deep`.
- `src/app.ts` — fábrica de la instancia Fastify (testeable con `inject()`), cablea servicios y monta rutas bajo `/api/v1`.
- `src/server.ts` — entrypoint HTTP con cierre ordenado (SIGINT/SIGTERM).

## Módulos de dominio (Fase 2)

**Farmacia** (`data/farmacias.json` + `data/farmacias-guardia-2026.json`, reales):

- `src/domain/farmacia.ts` — tipos (`Pharmacy`, `Holiday`, `GuardEntry`).
- `src/repositories/FarmaciaRepository.ts` — carga y valida (Zod) los ficheros de `data/`, memoiza en proceso.
- `src/services/FarmaciaService.ts` — validación de fecha/mes, resolución de festivo, `dashboard` (hoy + próximos N días).
- `src/routes/farmacia.ts` — `/api/v1/farmacia*`.

**Weather** (Open-Meteo, real):

- `src/domain/weather.ts` — tipos (`CurrentWeather`, `HourlyForecastPoint`, `DailySummary`).
- `src/clients/OpenMeteoClient.ts` — HTTP puro, expone la interfaz `WeatherProvider` (el Service depende de la interfaz, no de la clase concreta — permite testear con un doble sin red).
- `src/adapters/openMeteoAdapter.ts` — valida (Zod) y traduce la respuesta nativa al modelo de dominio; lanza `UpstreamError` si el contrato de Open-Meteo cambia.
- `src/services/WeatherService.ts` — cache 10 min, fallback a caché obsoleta si Open-Meteo falla (`meta.stale: true`), valida rango hoy..+7 días.
- `src/routes/weather.ts` — `/api/v1/weather*`.

## Módulos de dominio (Fase 3)

**Ambiente** (JCyL, real — dos datasets distintos detrás de un mismo servicio):

- `src/domain/ambiente.ts` — tipos (`AirQualitySnapshot`, `HourlyAirQuality`, `PollutantReading`).
- `src/clients/JcylClient.ts` — HTTP genérico para la API Opendatasoft de JCyL, con paginación por `offset`; expone la interfaz `JcylProvider`.
- `src/adapters/jcylAirQualityAdapter.ts` — dos pivotes distintos: `toHourlySnapshot` (formato largo del dataset "día en curso" → horas agrupadas) y `toDailySnapshot` (formato ancho del histórico diario → lista de contaminantes).
- `src/services/AmbienteService.ts` — enruta hoy → dataset horario, fecha pasada → histórico diario; cache 10 min (hoy) / 24h (histórico, no cambia retroactivamente).
- `src/routes/ambiente.ts` — `/api/v1/ambiente*`.

**Parking** (Ordenanza ORA, BOP Burgos 245/2021, dataset estático real):

- `src/domain/parking.ts`, `src/repositories/ParkingRepository.ts`, `src/services/ParkingService.ts`, `src/routes/parking.ts` — `/api/v1/parking*`.
- Sin cliente HTTP: es un dataset local, igual que farmacia. Nunca inventa disponibilidad (`availabilityStatus: "NOT_AVAILABLE"` siempre en `capacity`/`availableSpaces`).

**Residuos** (2 PDF oficiales del Ayuntamiento, dataset estático real):

- `src/domain/residuos.ts`, `src/repositories/ResiduosRepository.ts`, `src/services/ResiduosService.ts`, `src/routes/residuos.ts` — `/api/v1/residuos*`.

## Módulos de dominio (Fase 4)

**Bus** (GTFS real, `arandadeduero/gtfs-busurbano` vía GitHub Releases):

- `src/domain/bus.ts` — tipos (`BusLine`, `BusStop`, `NearestStopResult`, `NextBusEntry`).
- `src/clients/GtfsClient.ts` — descarga el último release + descomprime el zip **en memoria** con `fflate` (nunca escribe el zip a disco ni extrae directamente al filesystem — evita el vector de path-traversal/symlinks de las librerías que sí lo hacen); expone la interfaz `GtfsProvider`.
- `src/utils/csv.ts` — parser CSV propio (RFC 4180: comillas, comas y saltos de línea embebidos) para no añadir una dependencia por algo tan acotado.
- `src/adapters/gtfsAdapter.ts` — parsea los 6 ficheros GTFS a índices (`Map`) por id, y por parada/viaje para `stop_times.txt`.
- `src/utils/gtfsCalendar.ts` — resuelve si un `service_id` está activo en una fecha combinando `calendar.txt` (patrón semanal + rango) con las excepciones de `calendar_dates.txt` (prioridad siempre a la excepción), spec GTFS estándar.
- `src/utils/geo.ts` — distancia Haversine, para `/bus/nearest`.
- `src/repositories/GtfsRepository.ts` — persiste el feed descargado en disco (`GTFS_URBANO_CACHE_DIR`) como fallback "stale" si GitHub Releases falla; expone la interfaz `GtfsDataSource`.
- `src/services/BusService.ts` — `nextBuses` calcula la hora absoluta de cada `stop_time` para "hoy" y "ayer" (soporta servicios con hora codificada `>=24:00:00`, que cruzan medianoche según el propio estándar GTFS), filtra por `>= ahora` en `Europe/Madrid` y ordena.
- `src/routes/bus.ts` — `/api/v1/bus*`.

## Módulos de dominio (Fase 5 — última fase de módulos de datos de la v1)

**Río** (API real de terceros sobre datos SAIH-CHD):

- `src/domain/rio.ts` — tipos (`RiverSnapshot`, `RiverMetric`, `RiverMetricSummary`, `RiverTrend`).
- `src/clients/RioClient.ts` — HTTP puro contra `saih-chd-api-*.herokuapp.com`; expone la interfaz `RioProvider`. La fuente no admite filtros de fecha (comprobado en vivo: cualquier query param se ignora) — siempre devuelve la ventana móvil completa (~3 meses horarios).
- `src/services/RioService.ts` — calcula la tendencia (tramo de ±3h, umbral 2%) y recorta la serie a "últimas N horas" en nuestro lado, ya que la fuente no lo hace. Cache 10 min, fallback a caché obsoleta.
- `src/routes/rio.ts` — `/api/v1/rio*`. Sin `/rio/volumen`: la fuente no ofrece esa métrica para la estación de aforo (`nivel`/`caudal` solamente) — no se inventa el endpoint.

## Observabilidad (Fase 6 — no añade módulos de dominio nuevos)

- `src/telemetry/metrics.ts` — registro Prometheus (`prom-client`), contadores/histogramas propios (`http_requests_total`, `http_request_duration_seconds`, `external_requests_total`, `external_request_duration_seconds`, `cache_hits_total`, `cache_misses_total`, `api_errors_total`) más las métricas de proceso por defecto (`collectDefaultMetrics`). `withExternalRequestMetrics()` envuelve cada llamada de los 4 `Client` (Open-Meteo, JCyL, GitHub/GTFS, río) sin tocar su lógica de negocio.
- `src/plugins/metrics.ts` — hook `onResponse` que etiqueta por `request.routeOptions.url` (la **plantilla** de ruta, no la URL literal — evita que un parámetro como `:date` dispare la cardinalidad de las series) y `GET /metrics` en formato texto Prometheus. Vive en la raíz, fuera de `/api/v1`, igual que `/health`.
- `src/cache/InMemoryCache.ts` y `src/errors/error-handler.ts` — instrumentados con `cache_hits_total`/`cache_misses_total` y `api_errors_total` respectivamente, sin cambiar su contrato público.
- `src/services/MatomoService.ts` + `src/plugins/matomo.ts` — tracking **best-effort**: `track()` no es `async`, nunca lanza, y no hace ninguna llamada de red si `MATOMO_ENABLED=false` (por defecto). Un Matomo caído o lento no puede afectar nunca a la disponibilidad de la API.
- `src/diagnostics/sourceChecks.ts` — lógica de comprobación en vivo de cada fuente, extraída de `/health/deep` para que `GET /api/v1/meta/estado` (de cara al consumidor externo) la reutilice sin duplicar el `try/catch` por módulo.
- `src/telemetry/sources.ts` + `src/routes/meta.ts` — `GET /api/v1/meta/fuentes` (catálogo estático: procedencia, licencia, fiabilidad) y `GET /api/v1/meta/estado` (el mismo agregado que `/health/deep`, bajo `/api/v1`) — endpoints de transparencia (§3 ítems 18-19 de `docs/architecture-proposal.md`, requisito explícito del prompt maestro §32).

## Robustez y documentación (2026-09-09 — no añade fase nueva)

Pasada dedicada a cerrar huecos encontrados al auditar cada ruta contra su propio schema y su cobertura de test:

- **`response` schema completo en todas las rutas.** `residuos/*` (las 5 rutas existentes), `parking/ora` y `bus/stop/:id/next` no declaraban ningún `response` — la UI de /docs no mostraba shape de respuesta para ellas, y no había protección de la whitelist de serialización (Principio #5). Se añadió el schema completo a las 7, verificado campo a campo contra un servidor real levantado a propósito (no solo contra los tests) para no repetir el bug de Principio #5 una tercera vez.
- **`GET /api/v1/residuos/atencion-ciudadana` (nueva ruta).** `ResiduosService.getAtencionCiudadana()` existía desde la Fase 3, con datos reales validados (`data/residuos.json → atencionCiudadana`), pero nunca se había conectado a ninguna ruta HTTP — dato real e inalcanzable hasta ahora.
- **`description` en parámetros y operaciones** de prácticamente todas las rutas (formatos de fecha, rangos válidos, qué significa cada valor especial como `NOT_AVAILABLE` o un array vacío en domingo) — `/docs` pasa de mostrar solo tipos a explicar el comportamiento, verificado en `test/e2e/health.e2e.test.ts`.
- **Batería de tests de robustez ampliada** (148 → 162): límites de todos los query params numéricos (`days`, `count`, `hours`) por encima y por debajo del rango válido, verificación de shape completa (no solo un campo) en las respuestas recién dotadas de `response` schema, insensibilidad a mayúsculas de `/parking/ora/:district`, y el caso `lowConfidence: true` de farmacia contra una fecha real documentada en el caveat.

## Swagger UI → Scalar (2026-09-09)

`/docs` pasó de Swagger UI a Scalar (`@scalar/fastify-api-reference`), a petición del usuario ("una API bonita"). Detalle en el principio #8 de abajo — el cambio no fue solo estético, corrigió un bug real de CSP que Swagger UI ya tenía.

## Principios que sigue el código

1. **Ningún endpoint de datos inventa información.** Si una fuente no existe
   o no se ha decidido cómo tratarla, el módulo no se implementa (ver
   `docs/architecture-proposal.md` §6). Los datos reales (farmacias,
   residuos) se documentan con su procedencia y limitaciones en el propio
   fichero (`meta.caveat`), nunca se presentan como más fiables de lo que son.
2. **Fail fast en configuración**, nunca en tiempo de request.
3. **Errores tipados** (`AppError` y subclases) en toda la capa de servicio;
   la ruta nunca construye la respuesta de error a mano.
4. **Cache y resiliencia son responsabilidad del Service**, nunca de la
   Route ni del Client/Repository.
5. **El `response` schema de una ruta es una whitelist de serialización.**
   Cualquier ruta que declare uno debe envolver su `data` con
   `responseSchema()` (`src/routes/schemas.ts`) o Fastify descarta en
   silencio el resto de propiedades, incluido `meta` — error real que se
   coló (y se detectó de nuevo, dos veces: Fase 2 y Fase 4, esta última en
   `{ type: 'array', items: { type: 'object' } }` sin `properties`, que
   vacía cada elemento del array).
6. **Todo lo que un servicio escriba a disco en tiempo de ejecución** (p.
   ej. la caché del feed GTFS) necesita que el `Dockerfile` copie ese
   directorio con `--chown` al usuario no root — si no, falla en silencio
   dentro del contenedor aunque funcione en local. Detectado verificando
   el contenedor real, no solo el build.
7. **`z.coerce.boolean()` no sirve para variables de entorno tipo flag.**
   `Boolean("false")` es `true` en JS, así que ese coercer trataría
   `MATOMO_ENABLED=false` (string no vacío) como activado. `src/config/env.ts`
   usa `z.enum(['true', 'false']).transform(...)` para los flags booleanos
   en su lugar — detectado antes de que llegara a ejecutarse, revisando el
   propio schema al añadir `MATOMO_ENABLED` en la Fase 6.
8. **`app.inject()` no ejecuta JavaScript en el navegador.** Todos los tests
   E2E de este proyecto usan `fastify.inject()`, que solo comprueba status
   code/headers/body — nunca detecta que una página HTML no se renderiza
   porque el navegador bloquea un script. Así pasó inadvertido que Swagger
   UI generaba un `<script>` de inicialización inline, bloqueado por el CSP
   por defecto de Helmet (`script-src 'self'`, sin `'unsafe-inline'` ni
   nonce) — la ruta devolvía 200 pero la UI nunca llegaba a arrancar en un
   navegador real. Detectado por el usuario probando `/docs` en vivo
   (2026-09-09), no por los tests. Al migrar a Scalar (mismo problema: usa
   un script inline para arrancar, aunque carga el bundle principal desde
   un fichero propio del mismo origen), se relajó `script-src` a
   `'unsafe-inline'` **solo para `/docs`** (`src/plugins/security.ts`), y se
   añadió una comprobación explícita de la cabecera CSP y del HTML servido
   en los tests — lo único que sí puede detectar esta clase de bug sin un
   navegador real.

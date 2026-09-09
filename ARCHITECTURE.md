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
- `src/plugins/security.ts` — Helmet, CORS, rate limiting.
- `src/plugins/openapi.ts` — OpenAPI 3 + Swagger UI en `/docs`.
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

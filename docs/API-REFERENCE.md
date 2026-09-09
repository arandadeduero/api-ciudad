# API Reference — API Ciudad de Aranda de Duero

**Este es el documento de referencia interno y autoritativo de todos los endpoints.**
Regla de mantenimiento: **cualquier cambio a una ruta (nueva, modificada o eliminada) se refleja aquí en el mismo commit que el cambio de código.** No es opcional — es la fuente que se consulta antes de tocar cualquier endpoint, y la que hay que actualizar después.

Relación con el resto de la documentación:

- [`API.md`](../API.md) — resumen de una línea por endpoint, para lectura rápida en el README. Este fichero (`API-REFERENCE.md`) es el detalle completo: parámetros, ejemplos de payload reales, todos los códigos de error posibles.
- `/docs` (Scalar, generado desde el código — reemplazó a Swagger UI el 2026-09-09) — sigue siendo la fuente ejecutable/interactiva. Este documento es el complemento legible sin arrancar el servidor, y el que registra el _porqué_ de cada decisión (qué error devuelve y cuándo, qué hace el caché) que un schema OpenAPI no siempre deja claro de un vistazo.
- [`docs/architecture-proposal.md`](architecture-proposal.md) — investigación de fuentes y decisiones de arquitectura. Este documento no repite esa investigación, solo referencia la fuente de cada módulo.

**Última actualización:** 2026-09-09 (robustez y documentación: `response` schema completo en todas las rutas —incluidas `residuos/*`, `parking/ora` y `bus/stop/:id/next`, que antes no lo tenían—, `description` en parámetros y operaciones para que `/docs` sea autoexplicativo, endpoint `residuos/atencion-ciudadana` cerrado, batería de tests de robustez ampliada, y migración de `/docs` de Swagger UI a Scalar corrigiendo un CSP que bloqueaba su renderizado en el navegador — ver ARCHITECTURE.md).

---

## Convenciones

- **Base URL**: `/api/v1` para todos los endpoints de dominio. `/health*` y `/docs*` viven en la raíz (infraestructura, no dominio versionado).
- **Formato de éxito**: `{ "data": ..., "meta": { "source", "retrievedAt", "cached", "stale"? } }`. `meta.stale: true` solo aparece cuando se sirve una respuesta de caché obsoleta porque la fuente externa ha fallado.
- **Formato de error**: `{ "error": { "code", "message", "requestId" } }`. `code` es estable y apto para lógica de cliente; `message` es para humanos, en español, y puede cambiar de redacción.
- **Zona horaria**: todas las fechas "de hoy" (`/hoy`, `/dashboard`) se calculan en `Europe/Madrid`, no en la zona horaria del servidor.
- **Autenticación**: ninguna. La API es de acceso público sin restricción de origen (CORS `*`, decisión confirmada — ver `docs/architecture-proposal.md` §6).
- **`/docs` (Scalar)**: todas las rutas declaran `response` schema (shape completa, no solo `summary`) y `description` en parámetros no triviales — es fuente ejecutable fiable, no solo un placeholder. Se verifica en `test/e2e/health.e2e.test.ts`, incluida la propia cabecera CSP que permite renderizar la página.

---

## Health (raíz, fuera de `/api/v1`)

### `GET /health`

Estado general del proceso.

**Respuesta 200:**

```json
{ "status": "ok", "version": "0.1.0", "uptime": 12345 }
```

### `GET /health/live`

Liveness probe. Siempre `{ "status": "ok" }` si el proceso responde.

### `GET /health/ready`

Readiness probe — comprueba dependencias críticas (hoy: solo la cache).

**200** si todo ok: `{ "status": "ok", "checks": { "cache": "ok" } }`
**503** si algo falla: `{ "status": "degraded", "checks": { "cache": "error" } }`

### `GET /health/deep`

Diagnóstico por módulo. Siempre devuelve 200 (es informativo, no un gate — el gate es `/health/ready`). Cada entrada de `checks` tiene `status` uno de: `ok` | `degraded` (sirviendo caché obsoleta) | `error` | `excluded` (fuera de alcance de la v1 por decisión tomada). Ya no queda ningún módulo `not_implemented` — la Fase 5 (río) fue la última.

**Ejemplo real (2026-09-09):**

```json
{
  "status": "ok",
  "checks": {
    "cache": { "status": "ok" },
    "farmacia": { "status": "ok", "detail": "12 farmacias en catálogo" },
    "weather": { "status": "ok", "detail": "ok" },
    "ambiente": { "status": "ok", "detail": "ok" },
    "parking": { "status": "ok", "detail": "1 aparcamientos, 6 distritos ORA" },
    "residuos": { "status": "ok", "detail": "9 tipos de contenedor" },
    "bus": { "status": "ok", "detail": "3 líneas, 44 paradas" },
    "rio": { "status": "ok", "detail": "ok" },
    "eventos": {
      "status": "excluded",
      "detail": "Fuera de alcance de la v1 (decisión del usuario) — ver docs/architecture-proposal.md §6"
    },
    "cortescalles": { "status": "excluded", "detail": "..." }
  }
}
```

**Importante:** `/health/deep` hace una llamada real a cada fuente externa en cada invocación (Open-Meteo, JCyL, GitHub Releases, API del río) — no usa solo la caché. No lo pongas en un monitor de alta frecuencia.

---

## Farmacia (`/api/v1/farmacia`)

Fuente: Colegio Oficial de Farmacéuticos de Burgos (calendario de guardias 2026, extraído de PDF oficial y re-verificado contra el documento — ver `data/farmacias-guardia-2026.json` y `DATA-SOURCES.md`). Sin caché HTTP (los ficheros se cargan una vez en memoria al arrancar el proceso).

### `GET /api/v1/farmacia`

Catálogo completo de las 12 farmacias.

**Respuesta 200** (`data` es un array de 12 elementos):

```json
{
  "data": [
    {
      "id": 1,
      "name": "JULIÁN LÁZARO",
      "address": "Plaza Mayor, 11",
      "postalCode": "09400",
      "city": "Aranda de Duero",
      "zone": null,
      "phone": "947500269",
      "location": { "latitude": 41.6701895, "longitude": -3.6885626 }
    }
  ],
  "meta": {
    "source": "Colegio Oficial de Farmacéuticos de Burgos (Z.F. Aranda de Duero)",
    "retrievedAt": "...",
    "cached": false
  }
}
```

### `GET /api/v1/farmacia/hoy`

Farmacia de guardia de hoy (fecha calculada en `Europe/Madrid`).

**Respuesta 200:**

```json
{
  "data": {
    "date": "2026-09-09",
    "pharmacy": {
      "id": 8,
      "name": "A. Mª GONZÁLEZ LAFONT",
      "address": "Calle Burgo de Osma, 27",
      "...": "..."
    },
    "holiday": null,
    "lowConfidence": false
  },
  "meta": { "...": "..." }
}
```

`holiday` es `null` o `{ "date", "name", "scope": "nacional"|"autonomico" }` si el día es festivo (fuente: `data/festivos-2026.json`, BOCyL).
`lowConfidence: true` si la fecha está en la lista de 14 fechas de confianza más baja documentadas (ver caveat en `data/farmacias-guardia-2026.json`).

### `GET /api/v1/farmacia/forday/:date`

`:date` en formato `YYYY-MM-DD`.

| Caso                                                                            | Status | `error.code`                            |
| ------------------------------------------------------------------------------- | ------ | --------------------------------------- |
| Fecha con formato inválido o inexistente en el calendario (p. ej. `2026-02-30`) | 400    | `INVALID_DATE`                          |
| Fecha de un año sin calendario cargado (solo 2026 disponible)                   | 404    | `YEAR_NOT_AVAILABLE`                    |
| Fecha válida sin guardia registrada (no debería ocurrir para 2026)              | 404    | (mensaje genérico, sin code específico) |

### `GET /api/v1/farmacia/formonth/:month`

`:month` en formato `YYYY-MM`. Devuelve un array con una entrada por cada día del mes (28-31 elementos). 400 (`INVALID_MONTH`) si el formato o el mes (01-12) no es válido.

### `GET /api/v1/farmacia/dashboard?days=N`

Vista agregada: hoy + los próximos `days` días (1-14, por defecto 5). Pensada para UI/kiosco (propuesta por el usuario, 2026-09-09).

**Respuesta 200:**

```json
{ "data": { "today": { "...": "GuardEntry" }, "upcoming": [{ "...": "GuardEntry" }] } }
```

`upcoming` puede tener menos de `days` elementos si el calendario disponible se acaba antes (solo cubre 2026).

---

## Weather (`/api/v1/weather`)

Fuente: [Open-Meteo](https://open-meteo.com) (sin API key, límite 10.000 llamadas/día). Coordenadas por defecto: Plaza Mayor de Aranda de Duero (`ARANDA_LATITUDE`/`ARANDA_LONGITUDE`). Caché: `WEATHER_CACHE_TTL_SECONDS` (600s por defecto), con fallback a caché obsoleta (`meta.stale: true`) si Open-Meteo falla.

### `GET /api/v1/weather` / `GET /api/v1/weather/hoy` (alias)

Tiempo actual + previsión horaria de hoy.

**Respuesta 200 (ejemplo real):**

```json
{
  "data": {
    "current": {
      "time": "2026-09-09T09:45",
      "temperature": 14.7,
      "apparentTemperature": 11.8,
      "humidity": 75,
      "windSpeed": 20.8,
      "windDirection": 10,
      "precipitation": 0,
      "cloudCover": 83,
      "pressure": 1018.5,
      "uvIndex": 1.05
    },
    "today": [
      {
        "time": "2026-09-09T00:00",
        "temperature": 12.1,
        "precipitation": 0,
        "precipitationProbability": 5,
        "windSpeed": 10,
        "windDirection": 180,
        "weatherCode": 1
      }
    ]
  },
  "meta": { "source": "Open-Meteo (https://open-meteo.com)", "retrievedAt": "...", "cached": false }
}
```

### `GET /api/v1/weather/forday/:date`

`:date` en `YYYY-MM-DD`, debe estar entre hoy y hoy+7 días (límite del prompt original, y de lo que Open-Meteo cubre con calidad).

| Caso                          | Status | `error.code`        |
| ----------------------------- | ------ | ------------------- |
| Formato inválido              | 400    | `INVALID_DATE`      |
| Fecha fuera de \[hoy, hoy+7\] | 400    | `DATE_OUT_OF_RANGE` |

**Respuesta 200:**

```json
{
  "data": {
    "date": "2026-09-12",
    "hourly": ["...HourlyForecastPoint"],
    "daily": { "date": "2026-09-12", "sunrise": "...", "sunset": "..." }
  }
}
```

`daily` es `null` si Open-Meteo no devuelve resumen diario para esa fecha (no debería pasar dentro del rango soportado).

---

## Ambiente (`/api/v1/ambiente`)

Fuente: JCyL — Datos Abiertos (API Opendatasoft Explore v2.1, sin autenticación). Estación real: **"Aranda de Duero 2"** (id 82, C/ Sulidiza) — corrige un error de investigación inicial que afirmaba que no había estación en el municipio (ver `docs/architecture-proposal.md` §2.2). Caché: `AMBIENTE_CACHE_TTL_SECONDS` (600s) para el día en curso; 24h para datos históricos (no cambian retroactivamente).

**Dos fuentes distintas detrás del mismo endpoint**, con forma de dato distinta:

|               | Dataset `calidad-del-aire-del-dia-en-curso`            | Dataset `calidad-del-aire-datos-historicos-diarios`                                                              |
| ------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Cuándo se usa | `/ambiente`, `/ambiente/hoy`, `/ambiente/forday/:hoy>` | `/ambiente/forday/<fecha pasada>`                                                                                |
| Granularidad  | Horaria (`granularity: "hourly"`, campo `hourly`)      | Diaria agregada (`granularity: "daily"`, campo `daily`)                                                          |
| Frescura      | Prácticamente tiempo real                              | Con retraso de publicación de varios meses (validación oficial) — última fecha comprobada disponible: 2025-12-21 |

### `GET /api/v1/ambiente` / `GET /api/v1/ambiente/hoy` (alias)

**Respuesta 200 (ejemplo real, truncado):**

```json
{
  "data": {
    "station": {
      "id": 82,
      "name": "Aranda de Duero 2",
      "province": "Burgos",
      "location": { "latitude": 41.6701895, "longitude": -3.6885626 }
    },
    "date": "2026-09-09",
    "granularity": "hourly",
    "hourly": [
      {
        "hour": "00:00",
        "pollutants": [
          { "code": "NO", "label": "Monóxido de nitrógeno", "unit": "ug/m3", "value": 1.0 },
          { "code": "O3", "label": "Ozono", "unit": "ug/m3", "value": 36.0 }
        ]
      }
    ],
    "daily": null,
    "source": "JCyL — Datos Abiertos (dataset: calidad-del-aire-del-dia-en-curso)"
  },
  "meta": {
    "source": "JCyL — Datos Abiertos (Junta de Castilla y León)",
    "retrievedAt": "...",
    "cached": false
  }
}
```

Contaminantes confirmados en esta estación: NO, NO2, O3, PM10, PM25, SO2 (no todos aparecen necesariamente en cada hora — el dataset de origen omite filas sin lectura).

### `GET /api/v1/ambiente/forday/:date`

| Caso                                                                                   | Status | `error.code`                    |
| -------------------------------------------------------------------------------------- | ------ | ------------------------------- |
| Formato inválido                                                                       | 400    | `INVALID_DATE`                  |
| Fecha futura                                                                           | 400    | `DATE_IN_FUTURE`                |
| Fecha pasada sin dato en el histórico validado (aún no publicado, o demasiado antigua) | 404    | `HISTORICAL_DATA_NOT_AVAILABLE` |

**Respuesta 200 para fecha pasada (`granularity: "daily"`):**

```json
{
  "data": {
    "station": { "...": "..." },
    "date": "2025-12-21",
    "granularity": "daily",
    "hourly": [],
    "daily": [{ "code": "NO", "label": "Monóxido de nitrógeno", "unit": "ug/m3", "value": 2 }],
    "source": "JCyL — Datos Abiertos (dataset: calidad-del-aire-datos-historicos-diarios)"
  }
}
```

---

## Parking (`/api/v1/parking`)

Fuente: Ordenanza del Servicio ORA (BOP Burgos núm. 245, 28-dic-2021 — texto legal oficial, ver `data/parking.json`). Dataset estático, sin caché HTTP.

### `GET /api/v1/parking`

Lista de aparcamientos públicos (hoy: solo "Sol de las Moreras", único documentado con datos verificables).

**Respuesta 200:**

```json
{
  "data": [
    {
      "id": "sol-de-las-moreras",
      "name": "Sol de las Moreras",
      "type": "public",
      "address": "Calle Sol de las Moreras, 30",
      "postalCode": "09400",
      "city": "Aranda de Duero",
      "location": { "latitude": 41.6698519, "longitude": -3.6843645 },
      "hours": "24 horas (desde julio de 2026)",
      "capacity": null,
      "availableSpaces": null,
      "availabilityStatus": "NOT_AVAILABLE",
      "phone": "947509023"
    }
  ]
}
```

`capacity`/`availableSpaces` son siempre `null` y `availabilityStatus` siempre `"NOT_AVAILABLE"` — **no hay API de ocupación en tiempo real**, y este proyecto no inventa esos números (ver principio en `ARCHITECTURE.md`).

### `GET /api/v1/parking/:id`

404 (mensaje genérico) si el id no existe.

### `GET /api/v1/parking/ora`

Información completa del servicio ORA: horario (`schedule`), periodos exentos (`exemptPeriods`, incluye uno dinámico — "1er sábado de fiestas patronales"), duración máxima por tipo de usuario (`duration` — residentes sin límite, no residentes 2h en zona azul, 4h en las calles de zona verde), vehículos exentos (`exemptVehicles`), y los 6 distritos (`districts`, A-F).

### `GET /api/v1/parking/ora/:district`

`:district` no distingue mayúsculas/minúsculas (`a` == `A`). 404 (mensaje con la lista de distritos disponibles) si no existe.

**Respuesta 200 para `A`:**

```json
{
  "data": {
    "id": "A",
    "streets": [
      "Calle Miranda do Douro",
      "Plaza Corazón de María",
      "Calle Corazón de María",
      "Pasaje Primo de Rivera",
      "Calle Bajada al Molino (de plaza Jardines de Don Diego a pasaje Primo de Rivera)"
    ],
    "note": null
  }
}
```

---

## Residuos (`/api/v1/residuos`)

Fuente: 2 PDF oficiales del Ayuntamiento (Concejalía de Medio Ambiente / Aseo Urbano), ver `data/residuos.json`. Dataset estático, sin caché HTTP.

### `GET /api/v1/residuos/puntolimpio`

```json
{
  "data": {
    "operador": "Consorcio Provincial de Residuos Urbanos de Burgos",
    "direccion": "Carretera de La Aguilera, km 2,4",
    "usuarios": "Solo particulares",
    "horario": {
      "lunesAViernes": [
        { "periodo": "mañana", "desde": "10:00", "hasta": "14:00" },
        { "periodo": "tarde", "desde": "16:00", "hasta": "20:00" }
      ],
      "sabado": [{ "periodo": "mañana", "desde": "10:00", "hasta": "14:00" }],
      "excepciones": "Cerrado festivos"
    }
  }
}
```

### `GET /api/v1/residuos/contenedores`

Array de 9 tipos: `papel_carton`, `vidrio`, `envases_ligeros`, `organica`, `resto`, `aceite_vegetal`, `ropa_usada`, `pilas`, `medicamentos`. Solo `vidrio` (8:00-23:00) y `resto` (21:00-23:00) tienen `horarioDeposito` — el resto es `null` (sin restricción horaria documentada).

### `GET /api/v1/residuos/contenedores/:tipo`

404 (con la lista de tipos disponibles) si `:tipo` no existe.

### `GET /api/v1/residuos/enseres`

```json
{
  "data": {
    "descripcion": "Recogida de muebles y enseres voluminosos",
    "metodo": "Previa solicitud telefónica",
    "operador": "Valoriza Servicios Medioambientales, S.A.",
    "telefono": "947506050"
  }
}
```

Corrige una investigación previa que citaba erróneamente "Urbaser" como operador.

### `GET /api/v1/residuos/comercio-carton`

```json
{
  "data": {
    "descripcion": "...",
    "horario": { "diasSemana": "lunes a viernes", "desde": "13:00", "hasta": "14:00" },
    "instrucciones": "Cartón plegado y apilado junto a la isla de contenedores más cercana",
    "sancionPorIncumplimiento": "Hasta 150 € ...",
    "fuente": "secundaria — no confirmada en los PDF oficiales"
  }
}
```

**Único dato de todo el proyecto marcado explícitamente como fuente secundaria** (nota de prensa, no el PDF oficial) — verificar antes de tomarlo como definitivo.

### `GET /api/v1/residuos/atencion-ciudadana`

```json
{
  "data": {
    "telefono": "947546353",
    "horario": { "desde": "09:00", "hasta": "14:00" },
    "sedeElectronica": "https://sede.arandadeduero.es",
    "correo": "medioambiente@arandadeduero.es",
    "oficinas": [
      { "nombre": "Oficinas Medio Ambiente", "direccion": "Plaza Mayor, 13, 2ª planta" },
      { "nombre": "Oficinas Valoriza SM, S.A.", "direccion": "Calle Santander, nº 2" }
    ]
  }
}
```

Dato real (`data/residuos.json → atencionCiudadana`) que ya tenía método de `Service` desde la Fase 3 pero no tenía ruta HTTP — cerrado como parte del trabajo de robustez/documentación (2026-09-09).

---

## Bus (`/api/v1/bus`)

Fuente: feed GTFS real del bus urbano de Aranda de Duero ([`arandadeduero/gtfs-busurbano`](https://github.com/arandadeduero/gtfs-busurbano), 3 líneas L1/L2/L3, operador UTE Clemente-Davila). Se descarga el asset `latest.zip` del último release de GitHub en memoria (sin escribir el zip a disco — `fflate` evita así cualquier vector de path-traversal/symlinks al descomprimir un zip de terceros) y se persiste una copia de los `.txt` extraídos en `GTFS_URBANO_CACHE_DIR` como resiliencia: si GitHub Releases falla, se sirve esa copia (`meta.stale: true`). Licencia AGPL-3.0 declarada en el repo — pendiente confirmar su alcance real con el mantenedor antes de basar un uso comercial en este endpoint (ver `docs/architecture-proposal.md` §2.1b).

Sin caché HTTP con TTL: el feed se descarga una vez por arranque del proceso y se mantiene en memoria (es estático — solo cambia cuando el operador publica un nuevo release, algo infrecuente).

### `GET /api/v1/bus`

Resumen: líneas + número total de paradas.

```json
{
  "data": {
    "lines": [{ "id": "1", "shortName": "L1", "longName": "Aranda (Circular)", "color": "F31212" }],
    "stopCount": 44
  }
}
```

### `GET /api/v1/bus/lines`

Array de las 3 líneas (`id`, `shortName`, `longName`, `color`).

### `GET /api/v1/bus/lines/:line`

`:line` es el `route_id` del feed (`1`, `2` o `3`, no el nombre corto `L1`/`L2`/`L3`). 404 (con la lista de ids disponibles) si no existe.

### `GET /api/v1/bus/stops`

Array de las 44 paradas reales (`id`, `name`, `location`, `wheelchairAccessible`).

### `GET /api/v1/bus/stops/:id`

404 si el id no existe.

### `GET /api/v1/bus/nearest?lat=&lon=`

Parada más cercana a unas coordenadas (distancia Haversine), con las líneas que pasan por ella.

**Respuesta 200 (ejemplo real, coordenadas de la Plaza Mayor):**

```json
{
  "data": {
    "stop": {
      "id": "8",
      "name": "Plaza Mayor (Calle Postas)",
      "location": { "latitude": 41.6699, "longitude": -3.6884 },
      "wheelchairAccessible": true
    },
    "distanceMeters": 33,
    "lines": [
      { "id": "1", "shortName": "L1" },
      { "id": "2", "shortName": "L2" },
      { "id": "3", "shortName": "L3" }
    ]
  }
}
```

400 (mensaje genérico, sin `error.code` específico) si falta `lat` o `lon`, o no son numéricos.

### `GET /api/v1/bus/stop/:id/next?count=N`

Los próximos `N` autobuses (por defecto 2, máx. 10) en una parada, calculados en tiempo real contra el calendario GTFS (día de la semana + excepciones de `calendar_dates.txt`, zona horaria Europe/Madrid, con soporte para servicios que cruzan medianoche — horas `>=24:00:00` del propio estándar GTFS).

**Respuesta 200 (ejemplo real, consultado un miércoles a las 10:46):**

```json
{
  "data": {
    "stop": { "id": "8", "name": "Plaza Mayor (Calle Postas)", "...": "..." },
    "nextBuses": [
      {
        "line": "L1",
        "destination": "Aranda (Plz. Mediterráneo)",
        "scheduledTime": "10:52",
        "minutesUntil": 6
      },
      {
        "line": "L1",
        "destination": "Aranda (Amb. Norte)",
        "scheduledTime": "11:10",
        "minutesUntil": 24
      }
    ]
  }
}
```

`nextBuses` puede tener menos de `count` elementos si no quedan más servicios activos hoy en esa parada (p. ej. tras la última salida del día). 404 si la parada no existe.

**Nota sobre domingos:** el feed no tiene ningún `service_id` con el flag `sunday=1` — no hay servicio los domingos, `nextBuses` devolverá un array vacío ese día, lo cual es correcto (no un fallo).

---

## Río (`/api/v1/rio`)

Fuente: API real de terceros que envuelve datos del SAIH de la Confederación Hidrográfica del Duero (`saih-chd-api-9d034ff9d037.herokuapp.com`) — **no es la API oficial de la CHD**, que sigue sin exponer ninguna públicamente (ver `docs/architecture-proposal.md` §2.2b). Estación de aforo `EA013` (código fijo, sin catálogo de estaciones expuesto por la API — ver `RIVER_STATION_CODE`).

La API de origen siempre devuelve la ventana móvil completa que tenga cargada (~3 meses de histórico horario, comprobado en vivo: no admite ningún filtro de fecha/paginación, cualquier query param se ignora). El recorte a "últimas N horas" lo hace nuestro Service, no la fuente. Caché: `RIVER_CACHE_TTL_SECONDS` (600s), con fallback a caché obsoleta (`meta.stale: true`) si la fuente falla.

**Unidades:** la API de origen no las especifica en la respuesta. Se documentan como `m` (nivel) y `m³/s` (caudal) por ser la convención estándar de las redes SAIH/ROEA — no confirmadas literalmente por la fuente.

**Sin `/rio/volumen`:** las únicas métricas que la API soporta son `nivel`, `caudal`, `temperatura` y `pluviometria` (confirmado por su propio mensaje de error 400); para la estación `EA013` (de aforo) solo `nivel` y `caudal` devuelven datos. No existe "volumen" — no se ha construido ese endpoint para no inventar un dato que la fuente no ofrece.

**Tendencia (`trend`):** se calcula comparando el último valor con el de ~3 horas antes; un cambio relativo menor al 2% se considera `"estable"`, si no `"subiendo"` o `"bajando"`.

### `GET /api/v1/rio`

Resumen: último valor + tendencia de nivel y caudal (sin la serie completa).

**Respuesta 200 (ejemplo real):**

```json
{
  "data": {
    "stationCode": "EA013",
    "nivel": {
      "unit": "m",
      "latest": { "timestamp": "2026-09-09T08:00:00.000Z", "value": 1.08 },
      "trend": "bajando"
    },
    "caudal": {
      "unit": "m³/s",
      "latest": { "timestamp": "2026-09-09T08:00:00.000Z", "value": 7.05 },
      "trend": "bajando"
    },
    "source": "API de terceros sobre datos SAIH — Confederación Hidrográfica del Duero (no es la API oficial de la CHD)"
  }
}
```

### `GET /api/v1/rio/nivel?hours=N`

### `GET /api/v1/rio/caudal?hours=N`

Serie horaria de la métrica, filtrada a las últimas `hours` (1-720, por defecto 24). `latest` y `trend` siempre se calculan sobre la serie completa de la fuente, no sobre la ventana filtrada — filtrar a 1 hora no cambia la tendencia calculada.

400 (validación del propio JSON Schema de Fastify, sin pasar por el Service) si `hours` está fuera de `[1, 720]`.

**Respuesta 200 (ejemplo real, `/rio/caudal?hours=6`):**

```json
{
  "data": {
    "unit": "m³/s",
    "latest": { "timestamp": "2026-09-09T08:00:00.000Z", "value": 7.05 },
    "trend": "bajando",
    "series": [{ "timestamp": "...", "value": 7.3 }]
  }
}
```

---

## Métricas y transparencia

### `GET /metrics` (raíz, fuera de `/api/v1`)

Métricas en formato texto Prometheus (`prom-client`, ver `src/telemetry/metrics.ts`). Vive fuera de `/api/v1` como `/health`: es infraestructura del proceso, no un dato de dominio versionado. Sin autenticación en la v1 — a proteger con red interna / IP allowlist si se expone fuera del clúster.

Contadores/histogramas propios (además de los `process_*`/`nodejs_*` por defecto de `prom-client`):

| Métrica                                   | Tipo      | Labels                           | Qué mide                                                                                                                                |
| ----------------------------------------- | --------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `http_requests_total`                     | Counter   | `method`, `route`, `status_code` | Peticiones HTTP recibidas. `route` es la plantilla (`/api/v1/rio/:x`), no la URL literal — evita cardinalidad sin límite por parámetros |
| `http_request_duration_seconds`           | Histogram | `method`, `route`, `status_code` | Duración de las peticiones HTTP                                                                                                         |
| `external_requests_total`                 | Counter   | `source`, `outcome`              | Llamadas a fuentes externas (`open-meteo`, `jcyl`, `github-gtfs`, `rio-saih`), éxito/error                                              |
| `external_request_duration_seconds`       | Histogram | `source`                         | Duración de las llamadas a fuentes externas                                                                                             |
| `cache_hits_total` / `cache_misses_total` | Counter   | `domain`                         | Aciertos/fallos de caché, agrupados por el prefijo de la clave (`weather`, `ambiente`, `rio`, `diagnostics`, ...)                       |
| `api_errors_total`                        | Counter   | `code`, `status_code`            | Errores devueltos por la API (mismo `error.code` que en la respuesta JSON)                                                              |

**Ejemplo real (fragmento):**

```text
http_requests_total{method="GET",route="/api/v1/rio/nivel",status_code="200"} 1
external_requests_total{source="rio-saih",outcome="success"} 2
cache_hits_total{domain="rio"} 1
api_errors_total{code="ROUTE_NOT_FOUND",status_code="404"} 1
```

### `GET /api/v1/meta/fuentes`

Catálogo de todas las fuentes de datos que consume la API: procedencia, licencia, frecuencia de actualización y fiabilidad (§3 ítem 18 de `docs/architecture-proposal.md` — transparencia total, requisito explícito del prompt maestro §32). Datos estáticos, definidos en `src/telemetry/sources.ts` — cualquier cambio a una fuente debe reflejarse ahí en el mismo commit (misma regla que este documento).

**Respuesta 200 (ejemplo real, un elemento del array):**

```json
{
  "data": [
    {
      "id": "rio",
      "module": "Río (nivel y caudal)",
      "provider": "API de terceros sobre datos SAIH — Confederación Hidrográfica del Duero",
      "sourceUrl": "https://saih-chd-api-9d034ff9d037.herokuapp.com",
      "license": "No especificada — no es la API oficial de la CHD",
      "updateFrequency": "Casi tiempo real (ventana móvil de ~3 meses de histórico horario)",
      "reliability": "Media — servicio de terceros, sin SLA conocido",
      "status": "implemented",
      "notes": "Estación de aforo EA013. Solo nivel y caudal disponibles, no volumen."
    }
  ]
}
```

`status` es `"implemented"` o `"excluded"` (eventos, cortes de calles) — nunca "planned": todo lo que aparece en este catálogo o ya está implementado o es una decisión tomada de no implementarlo (ver `docs/architecture-proposal.md` §0).

### `GET /api/v1/meta/estado`

Equivalente de `/health/deep` de cara al consumidor externo (§3 ítem 19): mismos checks en vivo (comparten `src/diagnostics/sourceChecks.ts`), pero bajo `/api/v1` y con un `status` agregado (`"ok"` si todo ok, `"degraded"` si algo sirve caché obsoleta, `"down"` si algo falla del todo).

**Respuesta 200 (ejemplo real):**

```json
{
  "data": {
    "status": "ok",
    "sources": {
      "cache": { "status": "ok" },
      "farmacia": { "status": "ok", "detail": "12 farmacias en catálogo" },
      "weather": { "status": "ok", "detail": "ok" },
      "ambiente": { "status": "ok", "detail": "ok" },
      "parking": { "status": "ok", "detail": "1 aparcamientos, 6 distritos ORA" },
      "residuos": { "status": "ok", "detail": "9 tipos de contenedor" },
      "bus": { "status": "ok", "detail": "3 líneas, 44 paradas" },
      "rio": { "status": "ok", "detail": "ok" },
      "eventos": {
        "status": "excluded",
        "detail": "Fuera de alcance de la v1 (decisión del usuario) — ver docs/architecture-proposal.md §6"
      },
      "cortescalles": { "status": "excluded", "detail": "..." }
    }
  }
}
```

---

## Errores comunes a toda la API

| `error.code`                                                   | Status | Significado                                                                     |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`                                             | 400    | Genérico, cuando no hay un code más específico                                  |
| `INVALID_DATE`                                                 | 400    | Fecha con formato incorrecto o inexistente en el calendario                     |
| `INVALID_MONTH`                                                | 400    | Mes con formato incorrecto                                                      |
| `DATE_OUT_OF_RANGE`                                            | 400    | Fecha fuera del rango que la fuente soporta (weather: hoy..+7)                  |
| `DATE_IN_FUTURE`                                               | 400    | Fecha futura donde no tiene sentido (ambiente)                                  |
| `NOT_FOUND`                                                    | 404    | Genérico, recurso no encontrado                                                 |
| `YEAR_NOT_AVAILABLE`                                           | 404    | Año sin calendario de farmacia cargado                                          |
| `HISTORICAL_DATA_NOT_AVAILABLE`                                | 404    | Ambiente: fecha pasada sin dato histórico publicado                             |
| `ROUTE_NOT_FOUND`                                              | 404    | Ruta HTTP inexistente                                                           |
| `UPSTREAM_ERROR` / `*_ERROR` / `*_TIMEOUT` / `*_NETWORK_ERROR` | 502    | Fallo de una fuente externa (Open-Meteo, JCyL) sin caché de respaldo disponible |
| `INTERNAL_ERROR`                                               | 500    | Error no controlado — nunca debería filtrar detalles internos                   |

---

## Cómo mantener este documento

Cuando cambies un endpoint (nuevo, modificado, eliminado):

1. Actualiza la sección correspondiente aquí, con un ejemplo de payload **real** (no inventado — cópialo de una respuesta verificada, como se ha hecho en todo este documento).
2. Actualiza también `API.md` (resumen) si el cambio afecta a la tabla de rutas.
3. Si añades un `error.code` nuevo, añádelo a la tabla "Errores comunes".
4. Commit del código + este documento juntos, no en commits separados.

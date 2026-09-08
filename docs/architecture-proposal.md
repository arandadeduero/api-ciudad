# Propuesta de arquitectura — API Ciudad de Aranda de Duero

**Estado:** borrador para revisión — no implementar hasta aprobación explícita (ver §0 y §8).
**Fecha:** 2026-09-08 (actualizado 2026-09-09: bus urbano resuelto, ver §0 y §2.1b)

---

## 0. Resumen ejecutivo

Se ha hecho una investigación real (no asumida) de las fuentes de datos abiertas relevantes para Aranda de Duero, de referencias de arquitectura en otras ciudades españolas, y de los proveedores de datos externos mencionados en el prompt original. Los hallazgos **cambian varios supuestos** del prompt maestro. Antes de nada, lo importante:

| Módulo | Supuesto del prompt | Realidad encontrada | Impacto |
|---|---|---|---|
| Calidad del aire | JCyL tiene API con estaciones | ✅ Confirmado y probado en vivo (API REST JSON, sin auth) | Ninguno |
| Calidad del aire — **Aranda concretamente** | Se puede mostrar `/ambiente` para Aranda | ❌ **No existe ninguna estación JCyL en Aranda de Duero** (consulta a la API real: 0 resultados) | Hay que decidir estrategia: mostrar la estación operativa más cercana (con distancia y aviso explícito de que no es local), o no ofrecer el endpoint todavía |
| Eventos municipales | Existe JSON "raw" en la web del ayuntamiento | ❌ La web (`arandadeduero.es/servicio/eventos/`) es HTML server-rendered en WordPress, sin API ni RSS | Hay que decidir: scraping HTML propio (frágil, requiere mantenimiento) vs. omitir el módulo en la v1 |
| Autobús urbano / GTFS | "GTFS disponible en GitHub que proporcionaré" | ✅ **Resuelto (2026-09-09):** el usuario aportó el repositorio real [`arandadeduero/gtfs-busurbano`](https://github.com/arandadeduero/gtfs-busurbano) — feed GTFS completo (los 6 ficheros obligatorios + `calendar_dates.txt`, `shapes.txt`, `feed_info.txt`), 3 líneas (L1, L2, L3), operador Dávila Autocares, generado automáticamente por GitHub Actions y publicado como asset `latest.zip` en GitHub Releases. Ver detalle en §2.1b | Ya no bloquea la Fase 4. Sustituye a la interurbana del NAP como fuente principal de `/bus` |
| Cortes de calles | Integrar Waze si hay acceso autorizado | ⚠️ Waze for Cities es gratuito pero **requiere solicitud y aprobación como organismo público** (no es una API de autoservicio), y el acuerdo prohíbe redistribuir los datos públicamente sin más | El adapter debe construirse, pero el módulo no puede activarse hasta que el Ayuntamiento (no un desarrollador externo) solicite el acceso |
| Río | "Yo proporcionaré el API real" | La CHD/SAIH Duero (saihduero.es) **no expone API pública documentada**, solo un visor interactivo y descargas CSV manuales | Se construye el adapter (`RioClient`) desacoplado como pide el prompt, a la espera de que el usuario aporte el endpoint real o credenciales |
| Farmacias | Dataset ficticio inicial | Confirmado: no hay API pública de farmacias de guardia; el Colegio Oficial de Farmacéuticos de Burgos publica calendarios mensuales descargables (PDF) por zona farmacéutica, incluida "Z.F. Aranda de Duero" | Viable como fuente real futura vía **ingesta programada de PDF**, no como API; v1 usa el fixture JSON pedido |
| Parking / ORA | Zonas ORA reales | ✅ Confirmadas: distritos A, B y C con calles concretas, horario L–V 9–14h y 16–20h, máx. 4h | No hay API de ocupación en tiempo real para ORA ni para el parking Sol de las Moreras → se modela con `availabilityStatus: "NOT_AVAILABLE"` tal como pide el prompt |
| Meteorología | Open-Meteo | ✅ Confirmado: sin API key, JSON, 10.000 llamadas/día gratis (uso no comercial) | Ninguno. AEMET se documenta como alternativa/complemento oficial (avisos meteorológicos) |

**Conclusión operativa:** de los 8 módulos originales, **3 tienen fuente real inmediatamente utilizable con API** (weather, calidad del aire con matiz, farmacias como fixture), **2 dependen de que el usuario aporte una fuente** (bus/GTFS, río), **1 depende de un trámite institucional** (Waze/cortes de calles), y **1 no tiene fuente estructurada** (eventos, requeriría scraping o quedar fuera de la v1). Parking/ORA se puede modelar con datos estáticos verificados (calles, horarios, zonas) sin inventar disponibilidad.

Esto no invalida el proyecto: confirma que la arquitectura de **adapters desacoplados + degradación explícita (`NOT_AVAILABLE`, `stale`) + fixtures declarados** que pide el prompt es exactamente el patrón correcto para este caso real.

---

## 1. Ciudades de referencia — qué patrón adoptar de cada una

| Ciudad | Tecnología / patrón | Formatos | Auth | Qué nos sirve |
|---|---|---|---|---|
| **Zaragoza** | API REST propia + Swagger, catálogo en `/sede/servicio/catalogo/api.json` | JSON, GeoJSON, XML, CSV, JSON-LD, RDF, Turtle | Registro opcional (API key para apps) | Negociación de contenido por `Accept`/extensión; parámetros `fl`, `srsname`, `start`/`rows`, `sort`, `q` (FIQL); búsqueda por proximidad (`point`/`distance`). Buen modelo para nuestro futuro soporte GeoJSON (§25 del prompt) |
| **Madrid** | Catálogo propio + APIs REST específicas por dataset (parking, taxi TX), Swagger en `datos.madrid.es/swagger/openapi` | JSON, XML, CSV | Sin auth para lectura | Ejemplo directo de "API REST de parkings municipales" — referencia de payload para nuestro `/parking` |
| **Barcelona** | **CKAN** estándar (`opendata-ajuntament.barcelona.cat/data/api/`) | JSON vía CKAN datastore_search | Token opcional para más cuota | CKAN es el estándar de facto en portales españoles (también Valencia, Diputación de Salamanca) — útil si en el futuro integramos catálogos CKAN de otras administraciones |
| **Valencia / GVA** | CKAN (`opendata.vlci.valencia.es`, `dadesobertes.gva.es`) | JSON, CSV, XML | Sin auth | Mismo patrón CKAN; confirma que `package_list` / `package_show` es un patrón repetido a soportar como cliente genérico si se añaden más fuentes CKAN |
| **Valladolid / AUVASA** | Web propia con "tiempo real" del operador (no portal de datos abiertos con API formal); terceros (VallaBus) consumen **GTFS** | GTFS estático + tiempo real propietario | N/A | Confirma que en ciudades medianas españolas el patrón habitual para bus urbano es GTFS estático publicado ad-hoc, no una API REST propia — coherente con lo que necesitamos para Aranda |
| **Burgos (capital)** | Portal de datos abiertos (>7.000 registros, ~40 categorías) | XLSX, XML, JSON, CSV | — | **Sin API REST**, solo descarga de ficheros. Útil como fuente de "datasets" pero no de API en vivo — mismo patrón que farmacias (ingesta periódica, no polling en caliente) |
| **Salamanca** | Portal propio (`opendata.aytosalamanca.es`) + Diputación (`datosabiertossalamanca.es`, formato CKAN/DKAN) | CSV, JSON | — | Confirma el patrón "capital de provincia mediana = catálogo de ficheros, no API rica" — gestiona expectativas sobre lo que puede llegar a ofrecer Aranda a futuro |

**Patrón arquitectónico a adoptar:** ninguna de estas ciudades resuelve el problema con una única fuente homogénea; todas combinan APIs REST propias, CKAN, ficheros descargables y proveedores externos (meteorología, tráfico). Esto confirma la decisión de diseño de **adapters por proveedor + contrato estable en la API pública**, que es exactamente el patrón que Zaragoza usa para exponer RDF/JSON/CSV desde el mismo dataset interno.

---

## 2. Catálogo de fuentes — Aranda de Duero, JCyL, estatales

### 2.1 Ayuntamiento de Aranda de Duero

| Campo | Eventos | Farmacias de guardia | ORA / aparcamiento regulado | Parking Sol de las Moreras | Punto limpio / residuos |
|---|---|---|---|---|---|
| URL | arandadeduero.es/servicio/eventos/ | cofburgos.es (Colegio Of. Farmacéuticos Burgos, no el Ayto.) | arandadeduero.es/tema/aparcamiento-regulado/ | Calle Sol de las Moreras 30 (gestión municipal) | arandadeduero.es/horario-de-punto-limpio/ |
| Tipo de API | Ninguna (HTML) | Ninguna (descarga PDF mensual) | Ninguna (página informativa) | Ninguna | Ninguna (página informativa) |
| Formato | HTML | PDF | HTML | — | HTML |
| Autenticación | — | — | — | — | — |
| Frecuencia de actualización | Manual, según publicación | Mensual | Estática (ordenanza) | — | Estática |
| Licencia | No especificada | No especificada | No especificada | — | No especificada |
| Fiabilidad | Media (depende de mantenimiento web) | Alta (fuente oficial colegial) | Alta (ordenanza vigente) | Media | Media |
| Datos disponibles | Título, fecha, texto libre por evento | Farmacia de guardia por día y zona farmacéutica | Calles y distritos A/B/C, horario L–V 9–14h y 16–20h, máx. 4h, exención movilidad reducida | 24h desde jul-2026, gestión de tickets, sin plazas libres en tiempo real | Horario Punto Limpio (Ctra. de la Aguilera), recogida de muebles bajo llamada (Urbaser) |
| Limitaciones | Sin estructura de datos, cambia el HTML sin aviso → scraping frágil | El calendario es de ámbito de "zona farmacéutica" (Aranda), no solo del municipio; hay que verificar qué farmacias concretas cubre | No hay API de ocupación | No hay API de ocupación | No hay calendario de recogida por calle en formato abierto |
| ¿Automatizable? | Sí, mediante scraping HTML propio (frágil, requiere tests de contrato) o quedar fuera de v1 | Sí, mediante descarga y parseo periódico del PDF mensual | Sí, como dataset estático versionado a mano (no cambia a menudo) | No hay nada que automatizar salvo datos estáticos | Como dataset estático |

### 2.1b Bus urbano — GTFS real (aportado por el usuario, 2026-09-09)

| Campo | Detalle |
|---|---|
| Fuente | Repositorio [`arandadeduero/gtfs-busurbano`](https://github.com/arandadeduero/gtfs-busurbano) en GitHub |
| URL de descarga | `https://api.github.com/repos/arandadeduero/gtfs-busurbano/releases/latest` → asset `latest.zip` (verificado en vivo: release `v20260524-38`, asset `latest.zip`, 50.879 bytes) |
| Tipo de API | No es una API en el sentido REST; es un fichero GTFS estático distribuido vía GitHub Releases. El feed se genera automáticamente por GitHub Actions (autor de cada release: `github-actions[bot]`) |
| Formato | ZIP con los ficheros GTFS estándar: obligatorios (`agency.txt`, `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`) + opcionales presentes (`calendar_dates.txt`, `shapes.txt`, `feed_info.txt`) |
| Autenticación | Ninguna (repositorio y releases públicos) |
| Frecuencia de actualización | Irregular: releases cada 1-4 semanas entre feb-may 2026 (`v20260223` … `v20260524-38`), pero **sin release nuevo desde el 24-may-2026** (~3,5 meses a la fecha de este documento) — el `feed_info.txt`/vigencia declarada cubre 1-dic-2025 a 31-dic-2026, así que no hay motivo aparente para que no se actualice hasta entonces |
| Licencia | **AGPL-3.0**, declarada en el repositorio. Es una licencia de software copyleft aplicada aquí a un repositorio de datos generados — su alcance exacto sobre los ficheros GTFS (¿el código generador, o también los CSV de salida?) no es inequívoco. Dado que nuestra API es un servicio de red que expondría datos derivados de este feed, **conviene verificar con el mantenedor del repositorio** el alcance real de la licencia antes de publicar `/api/v1/bus` en producción, y en cualquier caso documentar la atribución («Fuente: Ayuntamiento de Aranda de Duero / Dávila Autocares, vía github.com/arandadeduero/gtfs-busurbano, AGPL-3.0») tal como exige el prompt maestro (§32) |
| Fiabilidad | Alta como dato (3 líneas reales: L1, L2, L3; operador Dávila Autocares) — pendiente de confirmar cuánto tiempo seguirá manteniéndose el repositorio activo dado el parón de releases desde mayo |
| Datos disponibles | Líneas L1, L2 (Polígono Industrial - Institutos), L3 (Sinovas - Urb. Costaján - Policía Nacional); paradas, horarios, calendario de servicio con excepciones de festivos (`calendar_dates.txt`), trazados GPS (`shapes.txt`) |
| Limitaciones | No hay endpoint de "próxima release" con notificación push — hay que consultar `releases/latest` periódicamente (razonable: cachear el ZIP descargado con TTL de horas, no de segundos, ya que el feed es estático y de baja frecuencia de cambio) |
| ¿Automatizable? | Sí, completamente: `GET releases/latest` (API de GitHub, sin auth para uso no intensivo) → descargar `latest.zip` → `GtfsRepository` parsea los ficheros tal como ya preveía el prompt maestro (§11) |

**Impacto en la arquitectura:** este feed sustituye a la línea interurbana del NAP como fuente **principal** de `/api/v1/bus` (ver revisión de §3 y §7 más abajo). El GTFS interurbano Madrid–Aranda–Burgo de Osma sigue siendo útil como fuente secundaria/complementaria (endpoint propuesto en §3, ítem 15), pero ya no es necesario como sustituto de arranque.

---

### 2.2 Junta de Castilla y León (JCyL)

| Campo | Estaciones de calidad del aire | Calidad del aire histórica/horaria | SAICA (calidad de aguas) / SAIH Duero |
|---|---|---|---|
| URL | `analisis.datosabiertos.jcyl.es` (dataset `estaciones-de-control-de-la-calidad-del-aire`) | `datosabiertos.jcyl.es` (`calidad-aire-historico-horario`), fichero >1 GB | `saihduero.es` (CHD, no JCyL) |
| Tipo de API | **API REST Opendatasoft Explore v2.1** — **probada y funcionando** | Descarga de fichero completo (no hay API de consulta filtrada confirmada) | Ninguna API pública; solo visor web interactivo |
| Formato | JSON, CSV, GeoJSON (estándar Opendatasoft) | CSV/fichero masivo | HTML interactivo, descarga CSV manual por estación |
| Autenticación | No requerida para lectura | No requerida | No requerida (no hay API) |
| Frecuencia de actualización | Baja (metadatos de estaciones) | Horaria (según nombre del dataset) | Tiempo casi real (ROEA/SAIH), pero sin API |
| Licencia | Reutilización según condiciones del portal JCyL (a verificar antes de redistribuir) | Igual | No especificada para uso programático |
| Fiabilidad | Alta (organismo oficial, API respondió con datos reales: 92 estaciones) | Alta como dato, baja usabilidad (fichero muy grande) | Media (datos "provisionales sujetos a revisión") |
| Datos disponibles | `estacion`, `operativa`, `provincia`, `localizacion`, `lat`, `long`, `altitud`, `posicion` | Contaminantes por hora y estación (PM10, NO2, O3, SO2, CO donde aplique) | Nivel/caudal por estación de aforo |
| Limitaciones clave | **Ninguna estación en Aranda de Duero** (verificado con `where=localizacion like "Aranda"` → 0 resultados). La estación operativa más próxima está en otra localidad de la provincia | Fichero completo demasiado grande para consultar en caliente; requiere ETL propio o buscar endpoint de consulta filtrada equivalente (pendiente de confirmar si existe un dataset "vivo" homólogo al de estaciones) | Sin API: cualquier integración requeriría scraping del visor o contacto directo con la CHD |
| ¿Automatizable? | Sí, vía API REST directa | Parcialmente (requiere ETL batch, no polling) | No sin colaboración de la CHD; se deja como adapter a la espera del endpoint que aporte el usuario (tal como pide el prompt en §12) |

### 2.3 Estatales / otros

| Fuente | Tipo | Formato | Auth | Utilidad para Aranda |
|---|---|---|---|---|
| **AEMET OpenData** | API REST oficial | JSON (vía URLs intermedias con TTL corto) | API key gratuita por email; **desde 15-oct-2026 las keys sin expiración dejan de funcionar** → usar API keys nuevas desde el diseño | Alternativa/complemento oficial a Open-Meteo: predicción por municipio (código INE de Aranda de Duero) y avisos meteorológicos oficiales |
| **Open-Meteo** | API REST pública | JSON | Sin key (uso no comercial) | Fuente principal de `/weather`, tal como pide el prompt; límite 10k llamadas/día — hay que cachear agresivamente (TTL 10 min) |
| **`arandadeduero/gtfs-busurbano`** (GitHub) | Feed GTFS estático, releases automáticas | GTFS (zip) | Sin auth | **Bus urbano real** (L1/L2/L3, operador Dávila Autocares) — fuente principal de `/bus`. Ver detalle completo en §2.1b |
| **NAP Transportes (nap.transportes.gob.es)** | Punto de acceso nacional GTFS | GTFS (zip) | Registro para publicar; lectura pública | Contiene GTFS de la línea interurbana Madrid–Aranda de Duero–Burgo de Osma (AISA) — fuente secundaria/complementaria a la urbana |
| **NAP DGT (nap.dgt.es)** | Punto de acceso nacional de tráfico | DATEX2 (XML), v3.6/3.7 | Registro | Incidencias de la red de carreteras del Estado (excluye País Vasco/Cataluña). Formato DATEX2 es complejo; cobertura de vías dentro del propio casco urbano de Aranda es previsiblemente nula o muy baja — más útil para incidencias en la AP-1/N-1 cercanas que para "cortes de calles" del municipio |
| **Waze for Cities** | Programa de datos, no API abierta | GeoRSS / JSON vía acuerdo de partner | Requiere alta como organismo público, sin coste, sin uso comercial, prohibido republicar los datos abiertamente sin más | Es la fuente que el prompt pide para `/cortescalles`, pero el trámite de alta debe iniciarlo el Ayuntamiento, no un desarrollador; mientras tanto se construye el adapter en modo "fuente no disponible" |
| **datos.gob.es** | Catálogo agregador nacional | Variable (redirige a portales origen) | — | No aporta datasets específicos y operativos de Aranda de Duero más allá de mapas geológicos/hidrogeológicos del IGME (no útiles para esta API) |
| **Diputación de Burgos** | — | — | — | No tiene portal de datos abiertos propio; se integra dentro de JCyL. Sin aportación adicional específica |

---

## 3. Endpoints adicionales propuestos (más allá de los 8 del prompt)

Clasificados por fuente, disponibilidad real, coste, frecuencia de cambio, dificultad de implementación y utilidad ciudadana (1–5).

| # | Endpoint propuesto | Fuente | Disponibilidad | Coste | Frecuencia de actualización | Dificultad | Utilidad ciudadana |
|---|---|---|---|---|---|---|---|
| 1 | `GET /api/v1/weather/avisos` | AEMET OpenData | Real, API oficial | Gratis (API key) | Alta (avisos meteorológicos) | Baja | 5 — alertas de seguridad |
| 2 | `GET /api/v1/ambiente/estacion-mas-cercana` | JCyL (adapter existente) | Real, con matiz (ninguna estación en Aranda) | Gratis | Media | Baja | 3 — transparente sobre la limitación |
| 3 | `GET /api/v1/rio/nivel-embalses` (p.ej. embalse de la zona) | CHD/SAIH (pendiente de API real) | No disponible aún | — | — | Media (depende del adapter) | 3 |
| 4 | `GET /api/v1/farmacia/zona-farmaceutica` | Colegio Of. Farmacéuticos Burgos (PDF) | Real, requiere ingesta | Gratis | Mensual | Media (parseo PDF) | 5 — uso diario alto |
| 5 | `GET /api/v1/residuos/puntolimpio` | Ayuntamiento (dato estático) | Real, estático | Gratis | Baja (rara vez cambia) | Baja | 4 |
| 6 | `GET /api/v1/residuos/muebles` (recogida de enseres bajo cita) | Ayuntamiento (dato estático: contacto Urbaser) | Real, estático | Gratis | Baja | Baja | 3 |
| 7 | `GET /api/v1/turismo/poi` (puntos de interés: bodegas, monumentos, rutas) | OpenStreetMap (Overpass API) | Real, API pública | Gratis | Baja | Media | 4 — turismo, uso por asistentes IA |
| 8 | `GET /api/v1/turismo/fuentes` (fuentes públicas de agua) | OpenStreetMap (Overpass) | Real | Gratis | Baja | Media | 3 |
| 9 | `GET /api/v1/turismo/parques` | OpenStreetMap (Overpass) | Real | Gratis | Baja | Media | 3 |
| 10 | `GET /api/v1/movilidad/recarga-electrica` (puntos de carga VE) | NAP DGT (dataset de puntos de recarga) o OpenStreetMap | Real (a validar cobertura en Aranda) | Gratis | Baja | Media | 4 |
| 11 | `GET /api/v1/trafico/incidencias` (vías estatales cercanas) | NAP DGT (DATEX2) | Real, cobertura limitada al entorno, no al casco urbano | Gratis | Alta (tiempo real) | Alta (parseo DATEX2) | 2 — utilidad marginal salvo AP-1/N-1 |
| 12 | `GET /api/v1/eventos/fiestas` (agenda oficial de Fiestas Patronales, contenido más estable que la agenda genérica) | Ayuntamiento (HTML, sección específica) | Real, requiere scraping puntual | Gratis | Estacional | Media | 4 — pico de interés cada septiembre |
| 13 | `GET /api/v1/instalaciones/deportivas` | Ayuntamiento (si publica listado) — a confirmar en investigación posterior | Por confirmar | Gratis | Baja | Media | 3 |
| 14 | `GET /api/v1/instalaciones/bibliotecas` | Ayuntamiento — a confirmar | Por confirmar | Gratis | Baja | Media | 2 |
| 15 | `GET /api/v1/bus/interurbano` (línea Madrid–Aranda–Burgo de Osma) | GTFS real en NAP (AISA) | Real y disponible | Gratis | Baja (GTFS estático, actualización esporádica) | Media (mismo `GtfsRepository` que el urbano, con dos fuentes) | 4 — complementa el bus urbano (§2.1b), ya resuelto como fuente principal |
| 16 | `GET /api/v1/parking/ora/zonas` | Ayuntamiento (ordenanza, dato estático verificado: distritos A/B/C) | Real, estático | Gratis | Muy baja | Baja | 4 |
| 17 | `GET /api/v1/geo/callejero` (geocodificación básica de direcciones del municipio) | OpenStreetMap Nominatim | Real | Gratis (uso respetuoso, rate-limited por OSM) | Baja | Media | 3 — soporte transversal para otros módulos (parking, farmacias, eventos con dirección) |
| 18 | `GET /api/v1/meta/fuentes` (metadatos de todas las fuentes: licencia, última actualización, estado) | Interno (agregación de metadatos de cada adapter) | Real, generado internamente | Gratis | En vivo | Baja | 5 — transparencia total, requisito explícito del prompt (§32) |
| 19 | `GET /api/v1/meta/estado` (dashboard de salud de cada fuente externa: ok/degradado/caído) | Interno | Real, generado internamente | Gratis | En vivo | Baja | 4 — complementa `/health/deep` de cara al consumidor externo |
| 20 | `GET /api/v1/calendario/festivos` (festivos locales/autonómicos/nacionales aplicables a Aranda) | Fuente estática (BOE/BOCyL) cargada como dataset | Real, estático versionado | Gratis | Anual | Baja | 4 — necesario para el propio cálculo de "próximos autobuses" (festivos GTFS) y farmacias |

**Nota:** los ítems 13–14 requieren una vuelta de investigación adicional (no se ha confirmado si el Ayuntamiento publica listados estructurados de instalaciones deportivas/culturales); se marcan como "por confirmar" y no se deben implementar como si la fuente ya existiera.

---

## 4. Arquitectura propuesta

### 4.1 Diagrama de capas

```text
                 ┌── Open-Meteo (weather)
                 ├── AEMET (avisos, alternativa weather)
                 ├── JCyL Opendatasoft (ambiente)
                 ├── Colegio Farmacéuticos Burgos (farmacia, PDF)
                 ├── Ayuntamiento Aranda (eventos, ORA, residuos — HTML/estático)
                 ├── NAP Transportes (bus interurbano GTFS)
                 ├── GTFS urbano (a aportar por el usuario)
                 ├── Waze for Cities (cortescalles — pendiente de alta institucional)
                 ├── CHD/SAIH Duero (rio — pendiente de API real)
                 └── OpenStreetMap Overpass/Nominatim (turismo, POIs, geo)
                       │
                       ▼
                ┌─────────────┐
                │   CLIENTS   │  (1 clase por proveedor, sin lógica de negocio)
                └──────┬──────┘
                       ▼
                ┌─────────────┐
                │  ADAPTERS   │  (normalizan la respuesta del proveedor a un modelo de dominio propio)
                └──────┬──────┘
                       ▼
                ┌─────────────┐
                │  SERVICES   │  (reglas de negocio: TTL, fallback, cálculo de "próximo bus", etc.)
                └──────┬──────┘
                       ▼
                ┌─────────────┐
                │    CACHE    │  (TTL configurable por dominio, memoria → Redis)
                └──────┬──────┘
                       ▼
                ┌─────────────┐
                │ CONTROLLERS │  (validación Zod, mapeo a respuesta HTTP)
                └──────┬──────┘
                       ▼
                ┌─────────────┐
                │ REST API v1 │  (OpenAPI, versionado, rate limit, GeoJSON opcional)
                └──────┬──────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Web/App       IA/Chat     Dashboards
```

La separación **Client → Adapter** (en vez de fusionarlos) es una capa extra respecto al prompt original, y se justifica así: el *Client* solo sabe hablar HTTP con el proveedor concreto (URL, auth, formato nativo); el *Adapter* traduce eso al modelo de dominio interno. Esto es lo que permite, por ejemplo, sustituir Open-Meteo por AEMET sin tocar `WeatherService`, o convivir con dos proveedores de meteorología a la vez (Open-Meteo como dato base, AEMET como fuente de avisos oficiales).

### 4.2 Stack técnico (última LTS disponible en el momento de implementar)

- **Node.js LTS** (confirmar versión exacta en el momento de arrancar la Fase 1 — no fijar aquí un número que quedará desactualizado).
- **TypeScript** en modo estricto.
- **Fastify** como framework HTTP (rendimiento, plugin `@fastify/swagger` + `@fastify/swagger-ui` para OpenAPI nativo, `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/cors`).
- **Zod** para validación de env vars, params, query, body y respuestas de proveedores externos (`safeParse` en los adapters — nunca confiar en la forma del JSON externo).
- **Pino** para logging estructurado (integrado nativamente en Fastify).
- **Vitest** para unit + integration tests.
- Para E2E: **Vitest + `light-my-request`** (motor de inyección de Fastify) para los tests que no requieren red real, y un runner de smoke-test aparte (Node script, sin framework) que sí levanta el proceso real y golpea HTTP, tal como pide §29.
- **undici** (cliente HTTP incluido en Node) con `retry`/`timeout` propios en vez de añadir una librería de circuit breaker pesada — para el volumen de tráfico esperado, un breaker simple hecho a mano (contador de fallos + estado abierto/cerrado/semi-abierto) es suficiente y más fácil de auditar que una dependencia externa.

### 4.3 Cache y resiliencia

- Abstracción `CacheService` con dos implementaciones: `InMemoryCache` (v1, por defecto) y `RedisCache` (activable por env var), mismo contrato (`get/set/getOrFetch con TTL`).
- TTLs por dominio configurables vía env, con los valores del prompt (§17) como default.
- Patrón **stale-while-error**: si la fuente externa falla y hay una entrada cacheada (aunque haya expirado su TTL), se sirve marcando `meta.cached: true, meta.stale: true` en vez de devolver 5xx — esto es crítico dado que varias fuentes (SAIH, Waze, scraping de eventos) son inherentemente frágiles.
- Timeouts cortos (2–5s) y máximo 2 reintentos con backoff exponencial en los `Client`, nunca en los `Service` (para no reintentar por capas).

### 4.4 Observabilidad

- Logging Pino con `requestId` (plugin `@fastify/request-id` o generado con `crypto.randomUUID()`), y logging separado de cada llamada saliente (proveedor, duración, éxito/fallo, cache hit/miss).
- Métricas Prometheus vía `prom-client`: contadores/histogramas tal como lista el prompt (§22), más un contador específico `external_source_availability{source="jcyl_air_quality"}` para poder alimentar el endpoint de transparencia `/api/v1/meta/estado` (propuesto en §3, ítem 19).
- Matomo como **best-effort**, con un `MatomoService` que hace fire-and-forget (no bloquea la respuesta, con timeout agresivo de 1-2s y captura de cualquier error sin loguearlo como error de la API).

### 4.5 Seguridad

- Helmet, CORS configurable por env (lista blanca de orígenes, no `*` en producción salvo que se decida explícitamente lo contrario para una API pública de datos abiertos — a decidir, ver §5).
- Rate limiting con `@fastify/rate-limit`, backend en memoria v1 / Redis cuando esté disponible, cabeceras estándar.
- Ningún secreto hardcodeado; `.env.example` con todas las variables (incluidas las de fuentes que aún no están activas, marcadas como opcionales).
- Sin stack traces en producción; capa de manejo de errores central que traduce cualquier excepción no controlada a un error tipado (`code`, `message`, `requestId`) sin filtrar detalles internos.

### 4.6 Versionado y formatos

- Prefijo `/api/v1` desde el primer commit, tal como recomienda el propio análisis del usuario.
- GeoJSON vía `?format=geojson` en los endpoints con componente geográfico (`parking`, `bus/stops`, `turismo/poi`), inspirado en el patrón de negociación de formato de Zaragoza, pero simplificado a un solo query param en vez de content negotiation completa (para no sobre-diseñar en la v1).

---

## 5. Decisiones técnicas y alternativas descartadas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Fastify | Express | Fastify tiene validación de esquemas y generación de OpenAPI de serie, mejor rendimiento, y es la opción que recomienda el propio prompt |
| Cliente HTTP: `undici` + retry manual | `axios-retry`, `cockatiel`, `opossum` (circuit breaker) | El volumen de tráfico y número de proveedores no justifica una dependencia de circuit breaker completa en la v1; un breaker de ~80 líneas cubre el caso de uso y es más fácil de testear. Se documenta como punto de extensión si el proyecto crece |
| Cache en memoria por defecto, Redis opcional | Redis obligatorio desde el día 1 | El prompt pide explícitamente no sobre-ingenierizar (§40); Redis se añade cuando haya más de una instancia del proceso corriendo (necesidad real de cache compartida) |
| Sin base de datos | Postgres/SQLite para persistir farmacias/parking | Los datos son ficheros JSON de bajo volumen y baja frecuencia de cambio; una base de datos añadiría complejidad operativa sin beneficio en esta fase, tal como pide explícitamente el prompt (§40) |
| Scraping propio para eventos, con tests de contrato (snapshot del HTML) | Excluir `/eventos` por completo de la v1 | Se documenta como opción abierta — **requiere decisión del usuario**, ver §6, porque el propio prompt prohíbe "inventar APIs que no existan" y aquí no hay ninguna; cualquier scraping debe presentarse como tal, no como "consumo de fuente oficial" |
| GTFS urbano como dependencia externa que aporta el usuario | Construir un GTFS sintético a partir de busurbanoaranda.com | Generar un GTFS a mano a partir de una web informativa violaría el requisito de "no inventar datos" (§38); mejor esperar el fichero real o excluir el módulo de la v1 |

---

## 6. Preguntas abiertas para el usuario (bloquean el arranque de ciertos módulos, no del proyecto)

1. **Eventos (`/eventos`)**: ¿autorizas hacer scraping HTML de `arandadeduero.es/servicio/eventos/` (frágil, con tests de contrato y aviso claro de `source: "scraping"` en la respuesta), o prefieres dejar el módulo fuera de la v1 hasta que exista una fuente estructurada?
2. ~~**Bus urbano (`/bus`)**~~ — **Resuelto 2026-09-09**: el usuario aportó [`arandadeduero/gtfs-busurbano`](https://github.com/arandadeduero/gtfs-busurbano), feed GTFS real (ver §2.1b). Queda una sub-pregunta menor: la licencia declarada es AGPL-3.0 sobre un repositorio de datos — ¿confirmamos con el mantenedor el alcance antes de publicar `/bus` en producción, o asumimos que cubre solo el código generador y publicamos citando la fuente?
3. **Río (`/rio`)**: ¿tienes contacto/acceso a un endpoint real de la CHD/SAIH, o construimos el adapter en modo "fuente no disponible" hasta entonces?
4. **Cortes de calles / Waze**: dado que el alta en Waze for Cities la debe tramitar el propio Ayuntamiento (no un desarrollador), ¿seguimos adelante solo con el adapter vacío (`WazeClient` que devuelve `NOT_AVAILABLE`), o prefieres que investigue fuentes alternativas (p. ej. avisos de obras publicados por el propio Ayuntamiento en HTML)?
5. **Calidad del aire para Aranda**: dado que no hay estación en el municipio, ¿mostramos la estación operativa más cercana con su distancia real y un aviso explícito, o preferís no publicar `/ambiente` hasta tener una fuente local?
6. ~~**CORS**~~ — **Resuelto 2026-09-09**: acceso público sin restricción de origen (`CORS_ORIGIN=*`), coherente con una API de datos abiertos. Es el default ya implementado en la Fase 1 (`src/plugins/security.ts`), confirmado ahora como decisión definitiva de producción y no solo como valor de desarrollo.

---

## 7. Plan de fases (ajustado a la disponibilidad real de fuentes)

| Fase | Contenido | Cambios respecto al prompt original |
|---|---|---|
| 1 | Core: Node, TS, Fastify, config, logging, errores, OpenAPI, health, Docker | Sin cambios |
| 2 | Farmacia (fixture) + Weather (Open-Meteo, con AEMET como fuente secundaria de avisos) | Se añade AEMET avisos como parte de la fase, por ser API oficial ya confirmada |
| 3 | Ambiente (JCyL, con resolución de estación más cercana) + Parking/ORA (datos estáticos verificados) | Eventos se aplaza a una fase 3b condicionada a la respuesta de la pregunta 1 (§6) |
| 4 | Bus: `GtfsRepository` sobre el GTFS urbano real (`arandadeduero/gtfs-busurbano`, descarga automática desde GitHub Releases) como fuente principal; GTFS interurbano del NAP como fuente secundaria (`/bus/interurbano`, endpoint §3.15) | Fase ya desbloqueada por completo (2026-09-09) — no depende de ninguna otra decisión pendiente |
| 5 | Río (adapter a la espera) + Cortes de calles (adapter a la espera de alta institucional en Waze) | Ambos quedan como adapters "stub" documentados, no bloquean el resto |
| 6 | Matomo + Prometheus + endpoints de transparencia (`/meta/fuentes`, `/meta/estado`) | Se añaden los endpoints de transparencia propuestos en §3 |
| 7 | E2E, smoke tests, CI/CD, hardening | Sin cambios |

---

*No se ha escrito código de producción todavía. Se espera revisión de este documento y respuesta a las preguntas de §6 antes de iniciar la Fase 1, salvo indicación expresa de continuar automáticamente.*

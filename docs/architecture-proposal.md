# Propuesta de arquitectura — API Ciudad de Aranda de Duero

**Estado:** todas las preguntas de §6 resueltas (2026-09-09) — desbloqueado para implementación por fases (ver §7).
**Fecha:** 2026-09-08 (actualizado 2026-09-09: bus urbano, río, ambiente, farmacias, residuos, eventos y CORS resueltos)

---

## 0. Resumen ejecutivo

Se ha hecho una investigación real (no asumida) de las fuentes de datos abiertas relevantes para Aranda de Duero, de referencias de arquitectura en otras ciudades españolas, y de los proveedores de datos externos mencionados en el prompt original. Los hallazgos **cambian varios supuestos** del prompt maestro. Antes de nada, lo importante:

| Módulo | Supuesto del prompt | Realidad encontrada | Estado |
|---|---|---|---|
| Calidad del aire | JCyL tiene API con estaciones | ✅ Confirmado y probado en vivo (API REST JSON, sin auth) | Resuelto |
| Calidad del aire — **Aranda concretamente** | Se puede mostrar `/ambiente` para Aranda | ⚠️➡️✅ **Corrección de un error propio (2026-09-09):** la primera investigación afirmó "no hay estación en Aranda" — era **incorrecto**, filtré por el campo equivocado (`localizacion`, la dirección física, en vez de `estacion`, el nombre). Sí existe: **"Aranda de Duero 2"** (activa, C/ Sulidiza), confirmada además por un segundo dataset real de mediciones del día en curso que el usuario aportó. Ver §2.2 | Resuelto — dato real disponible, con corrección documentada |
| Eventos municipales | Existe JSON "raw" en la web del ayuntamiento | ❌ La web es HTML server-rendered en WordPress, sin API ni RSS | **Resuelto (decisión del usuario, 2026-09-09): fuera de alcance de la v1.** No se construye ningún adapter ni endpoint de eventos |
| Autobús urbano / GTFS | "GTFS disponible en GitHub que proporcionaré" | ✅ **Resuelto (2026-09-09):** repositorio real [`arandadeduero/gtfs-busurbano`](https://github.com/arandadeduero/gtfs-busurbano) — feed GTFS completo, 3 líneas (L1, L2, L3), operador Dávila Autocares, releases automáticas vía GitHub Actions. Ver §2.1b | Resuelto |
| Cortes de calles | Integrar Waze si hay acceso autorizado | ⚠️ Waze for Cities requiere alta institucional del Ayuntamiento, no es autoservicio | **Resuelto (decisión del usuario, 2026-09-09): no disponible por ahora.** Se documenta el adapter como no implementado, sin trámite en curso |
| Río | "Yo proporcionaré el API real" | ✅ **Resuelto (2026-09-09):** el usuario aportó una API real (`saih-chd-api-9d034ff9d037.herokuapp.com`), probada en vivo — nivel y caudal por estación. Ver §2.2b | Resuelto |
| Farmacias | Dataset ficticio inicial | ✅ **Resuelto (2026-09-09):** el usuario aportó el calendario real de guardias 2026 (extraído del PDF oficial del Colegio de Farmacéuticos de Burgos) y el catálogo de las 12 farmacias, geocodificadas vía Nominatim. Ver §2.1 | Resuelto — datos reales, no fixture |
| Parking / ORA | Zonas ORA reales | ✅ Confirmadas: distritos A, B y C con calles concretas, horario L–V 9–14h y 16–20h, máx. 4h | Resuelto — dataset estático |
| Meteorología | Open-Meteo | ✅ Confirmado: sin API key, JSON, 10.000 llamadas/día gratis (uso no comercial) | Resuelto |
| Residuos | No contemplado en el prompt original | ✅ **Añadido (2026-09-09):** el usuario aportó 2 PDF oficiales del Ayuntamiento (díptico de separación + guía de contenedores) con horarios de depósito por tipo de contenedor, punto limpio, recogida de enseres y contacto de Valoriza. Ver §2.1c | Resuelto — dataset estático |

**Conclusión operativa:** de los módulos identificados, **todos tienen ya fuente real y decisión tomada**, salvo **Waze/cortes de calles**, que queda explícitamente fuera de alcance mientras no haya trámite institucional, y **eventos**, excluido deliberadamente de la v1. El resto (weather, ambiente, farmacias, parking/ORA, bus urbano+interurbano, río, residuos) puede implementarse ya sin ninguna decisión pendiente.

Esto confirma que la arquitectura de **adapters desacoplados + degradación explícita (`NOT_AVAILABLE`, `stale`) + fuentes reales documentadas con su procedencia** que pide el prompt es el patrón correcto para este caso real — y que investigar antes de implementar (§0 del prompt) evitó dar por buena una conclusión propia que resultó ser errónea (la estación de Aranda).

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

> **Eventos**: excluido de la v1 por decisión del usuario (2026-09-09) — la web (`arandadeduero.es/servicio/eventos/`) sigue sin API ni RSS (HTML server-rendered en WordPress), y no se construye ningún adapter ni endpoint para este módulo.

| Campo | Farmacias de guardia | ORA / aparcamiento regulado | Parking Sol de las Moreras |
|---|---|---|---|
| URL | Fuente original: cofburgos.es. **Datos ya extraídos y en el repo**: `data/farmacias.json` (catálogo) + `data/farmacias-guardia-2026.json` (calendario) | arandadeduero.es/tema/aparcamiento-regulado/ | Calle Sol de las Moreras 30 (gestión municipal) |
| Tipo de API | Ninguna — PDF oficial ya descargado y extraído por el usuario | Ninguna (página informativa) | Ninguna |
| Formato | PDF de origen → JSON normalizado en el repo | HTML | — |
| Autenticación | — | — | — |
| Frecuencia de actualización | Anual (calendario 2026 completo, 365 días) | Estática (ordenanza) | — |
| Licencia | No especificada por la fuente — uso informativo, verificar antes de redistribución comercial | No especificada | — |
| Fiabilidad | Alta como fuente (Colegio Oficial de Farmacéuticos), **con matiz**: la extracción automática del PDF (día-de-mes verificado programáticamente 1..365 sin huecos; farmacia-del-día verificada solo por co-ubicación espacial en el PDF, no contrastada con una segunda fuente) — ver caveat en `data/farmacias-guardia-2026.json.meta.caveat` | Alta (ordenanza vigente) | Media |
| Datos disponibles | 12 farmacias (nombre, dirección, teléfono, zona, geocodificadas con Nominatim — 9 con precisión de portal exacto, 3 a nivel de calle) + calendario de guardia día a día para todo 2026 | Calles y distritos A/B/C, horario L–V 9–14h y 16–20h, máx. 4h, exención movilidad reducida | 24h desde jul-2026, gestión de tickets, sin plazas libres en tiempo real |
| Limitaciones | Ver caveat de extracción arriba; no hay forma de detectar cambios de última hora (bajas/vacaciones) sin re-consultar la fuente original | No hay API de ocupación | No hay API de ocupación |
| ¿Automatizable? | Ya ingerido para 2026; para 2027 habrá que repetir la extracción del nuevo PDF anual (o negociar un feed con el Colegio) | Sí, como dataset estático versionado a mano (no cambia a menudo) | No hay nada que automatizar salvo datos estáticos |

### 2.1c Residuos (añadido 2026-09-09, aportado por el usuario)

| Campo | Detalle |
|---|---|
| Fuente | 2 PDF oficiales del Ayuntamiento (Concejalía de Medio Ambiente / Aseo Urbano): díptico de separación de residuos + guía de depósito en contenedores. Datos ya extraídos en `data/residuos.json` |
| Tipo de API | Ninguna — documentos PDF, sin fuente digital estructurada |
| Formato | PDF de origen → JSON normalizado en el repo |
| Autenticación | — |
| Frecuencia de actualización | Estática (documento institucional, sin fecha de próxima revisión conocida) |
| Licencia | No especificada — documento informativo municipal |
| Fiabilidad | Alta para punto limpio, contenedores y contactos (fuente oficial primaria). **Media** para el horario de recogida de cartón comercial (13:00-14:00h L-V): procede de una nota de prensa (revista360y5.es) que cita a la Concejalía, no de los PDF oficiales — no confirmado en fuente primaria |
| Datos disponibles | Punto limpio (horario, dirección), 9 tipos de contenedor con instrucciones y horario de depósito donde aplica (vidrio 8-23h, resto 21-23h), recogida de enseres (**Valoriza Servicios Medioambientales, S.A., tel. 947 50 60 50** — corrige una mención anterior errónea a "Urbaser" en la investigación inicial), recogida puerta a puerta de cartón comercial, contacto de atención ciudadana |
| Limitaciones | Sin calendario de recogida domiciliaria por calle/día (no estaba en los PDF aportados) |
| ¿Automatizable? | No hace falta: es un dataset estático de baja frecuencia de cambio, se versiona a mano igual que ORA |

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

### 2.2 Junta de Castilla y León (JCyL) — calidad del aire

> **Corrección de un error propio (2026-09-09):** la investigación inicial (2026-09-08) afirmó que "no existe ninguna estación JCyL en Aranda de Duero", basándose en `where=localizacion like "Aranda"` → 0 resultados sobre el dataset de estaciones. Eso fue un **error de mi parte**: `localizacion` es la dirección física (p. ej. "C/ Sulidiza"), no el nombre de la estación. Repitiendo la consulta sobre el campo correcto (`estacion`) aparecen **2 estaciones**: "Aranda de Duero" (inactiva) y **"Aranda de Duero 2"** (operativa, C/ Sulidiza, lat 41.66556, lon -3.68889). El usuario además aportó el dataset de mediciones reales que lo confirma de forma independiente.

| Campo | Estaciones de calidad del aire (catálogo) | **Calidad del aire del día en curso (mediciones reales, aportado por el usuario)** |
|---|---|---|
| URL | `analisis.datosabiertos.jcyl.es`, dataset `estaciones-de-control-de-la-calidad-del-aire` | `analisis.datosabiertos.jcyl.es`, dataset `calidad-del-aire-del-dia-en-curso` — probado en vivo: `.../records?refine=nombreprovincia:"Burgos"&refine=nombreestacion:"Aranda de Duero 2"` |
| Tipo de API | API REST Opendatasoft Explore v2.1 | Misma API (Opendatasoft Explore v2.1) |
| Formato | JSON, CSV, GeoJSON | JSON, CSV, GeoJSON |
| Autenticación | No requerida | No requerida |
| Frecuencia de actualización | Baja (metadatos de estaciones) | Horaria, datos del día en curso (verificado: `dia` incluye el día de hoy con lecturas hasta la hora actual) |
| Licencia | Reutilización según condiciones del portal JCyL (a verificar antes de redistribuir) | Igual |
| Fiabilidad | Alta | Alta — dataset probado con datos reales de hoy |
| Datos disponibles | `estacion`, `operativa`, `provincia`, `localizacion`, `lat`, `long`, `altitud`, `posicion` | Formato "largo" (una fila por contaminante y hora): `dia`, `hora`, `codprovincia`, `nombreprovincia`, `idestacion` (82 para Aranda de Duero 2), `nombreestacion`, `contaminantes` (nombre+unidad, p. ej. `"PM10 (ug/m3)"`), `valor`. **Contaminantes confirmados en Aranda de Duero 2**: NO, NO2, O3, PM10, PM25, SO2 (los que use §7 del prompt maestro: "usa todas las posibles métricas") |
| Limitaciones clave | Ninguna estación de nombre exacto "Aranda de Duero" (la vigente es "Aranda de Duero 2") | Formato largo (no una fila por hora con todas las métricas, sino una fila por métrica-hora) — el adapter debe pivotar a un formato ancho para la respuesta pública. **Paginación**: `total_count` (126 registros para un día típico) supera el `limit` por defecto (20) — iterar con `offset` tal como indicó el usuario hasta cubrir `total_count` |
| ¿Automatizable? | Sí, vía API REST directa | Sí, vía API REST directa con paginación por `offset` |

### 2.2b Río — SAIH CHD (API real aportada por el usuario, 2026-09-09)

| Campo | Detalle |
|---|---|
| Fuente | `https://saih-chd-api-9d034ff9d037.herokuapp.com` — servicio de terceros/comunitario (Heroku) que envuelve datos del SAIH de la Confederación Hidrográfica del Duero, **no es la API oficial de la CHD** (que sigue sin exponer una públicamente, ver saihduero.es) |
| URL / patrón | `GET /station/aforo/{codigoEstacion}/{metrica}` — probado en vivo con `EA013` |
| Tipo de API | REST JSON, sin discovery endpoint (`/`, `/stations`, `/station`, `/docs` devuelven 404) |
| Formato | JSON: array de `{ "d": "dd/mm/aaaa HH:MM", "v": number, "@timestamp": ISO8601 }` |
| Autenticación | Ninguna |
| Métricas válidas | `nivel`, `caudal`, `temperatura`, `pluviometria` (confirmado por el mensaje de error 400 al pedir una inválida). **Para `EA013` (estación de aforo) solo `nivel` y `caudal` devuelven datos** — `temperatura`/`pluviometria` devuelven `[]` (probablemente son métricas de otro tipo de estación, meteorológica) |
| Frecuencia de actualización | Datos hasta la hora actual menos ~2h (verificado: último registro a 2 horas del momento de la consulta) — prácticamente tiempo real |
| Ventana de datos | Ventana móvil de ~3 meses (2066 registros horarios ≈ 86 días) — no parece ser un archivo histórico completo, sino los datos recientes |
| Licencia | No especificada — servicio de terceros, sin términos de uso publicados. **Documentar la fuente real (CHD/SAIH) como origen del dato subyacente y este servicio como el medio técnico de acceso** |
| Fiabilidad | Alta como dato en sí (consistente con "datos provisionales sujetos a revisión" del SAIH oficial); **media como servicio** — es una app de terceros en Heroku (plan gratuito de Heroku puede dormir o desaparecer), no infraestructura oficial del organismo de cuenca |
| Datos disponibles | Nivel (m, sin confirmar unidad exacta en la respuesta) y caudal (m³/s, sin confirmar unidad exacta) por hora, estación EA013 |
| Limitaciones | Sin endpoint de catálogo de estaciones — el código de estación (`EA013`) debe conocerse de antemano; un código inválido devuelve `200 []` en vez de 404, así que el adapter no puede distinguir "estación inexistente" de "sin datos" solo por el status code |
| ¿Automatizable? | Sí, directamente. `RioClient` ya puede implementarse contra esta URL real en vez de quedar en modo stub |

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
| 2 | ~~`GET /api/v1/ambiente/estacion-mas-cercana`~~ → innecesario: la estación "Aranda de Duero 2" **es** la del municipio (§2.2) | JCyL, dataset `calidad-del-aire-del-dia-en-curso` | Real | Gratis | Horaria | Baja | 5 — dato local real, no aproximado |
| 3 | `GET /api/v1/rio/nivel`, `GET /api/v1/rio/caudal` (ya cubiertos por el diseño original §12 del prompt, ahora con fuente real) | SAIH-CHD API (§2.2b) | Real | Gratis | Casi tiempo real | Baja (JSON simple) | 4 |
| 4 | `GET /api/v1/farmacia/dashboard` — vista agregada para UI/kiosco: farmacia de hoy + próximos N días + si el día es festivo (nacional/CyL/local) | `data/farmacias.json` + `data/farmacias-guardia-2026.json` (ya en el repo) | Real | Gratis | Diaria | Baja | 5 — pensado para consumo visual directo, propuesto por el usuario (2026-09-09) |
| 5 | `GET /api/v1/residuos/puntolimpio`, `GET /api/v1/residuos/contenedores`, `GET /api/v1/residuos/comercio-carton` | `data/residuos.json` (ya en el repo, ver §2.1c) | Real, estático | Gratis | Baja (rara vez cambia) | Baja | 4 |
| 6 | `GET /api/v1/residuos/enseres` (recogida de enseres bajo cita) | `data/residuos.json` — contacto real: Valoriza Servicios Medioambientales, S.A., 947 50 60 50 | Real, estático | Gratis | Baja | Baja | 3 |
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

## 6. Preguntas — todas resueltas (2026-09-09)

1. ~~**Eventos**~~ — **Resuelto: fuera de alcance de la v1.** No se construye ningún adapter ni endpoint de eventos. Ver nota en §2.1.
2. ~~**Bus urbano (`/bus`)**~~ — **Resuelto**: GTFS real aportado, [`arandadeduero/gtfs-busurbano`](https://github.com/arandadeduero/gtfs-busurbano) (§2.1b). Sub-pregunta pendiente y de bajo riesgo: confirmar con el mantenedor el alcance de la licencia AGPL-3.0 antes de publicar `/bus` en producción — no bloquea el desarrollo, sí la salida a producción.
3. ~~**Río (`/rio`)**~~ — **Resuelto**: API real aportada (§2.2b), `saih-chd-api-9d034ff9d037.herokuapp.com`, probada en vivo.
4. ~~**Cortes de calles / Waze**~~ — **Resuelto: no disponible por ahora.** Se documenta `WazeClient` como no implementado; no hay trámite institucional en curso. Revisar si el Ayuntamiento decide solicitar el alta a Waze for Cities en el futuro.
5. ~~**Calidad del aire para Aranda**~~ — **Resuelto**: sí hay estación real ("Aranda de Duero 2"), y el usuario aportó el dataset de mediciones del día en curso (§2.2). Corrige un error de la investigación inicial.
6. ~~**CORS**~~ — **Resuelto**: acceso público sin restricción de origen (`CORS_ORIGIN=*`), ya implementado en la Fase 1.

Añadido fuera de la lista original: **farmacias** (§2.1, datos reales del Colegio de Farmacéuticos aportados y ya en el repo) y **residuos** (§2.1c, PDFs oficiales del Ayuntamiento aportados y ya en el repo).

---

## 7. Plan de fases (actualizado 2026-09-09 — todo desbloqueado salvo lo explícitamente excluido)

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Core: Node, TS, Fastify, config, logging, errores, OpenAPI, health, Docker | ✅ Completada |
| 2 | Farmacia (datos reales: `data/farmacias.json` + `data/farmacias-guardia-2026.json`) + Weather (Open-Meteo, con AEMET como fuente secundaria de avisos) | Desbloqueada — siguiente a implementar |
| 3 | Ambiente (JCyL, dataset `calidad-del-aire-del-dia-en-curso`, estación "Aranda de Duero 2") + Parking/ORA (datos estáticos verificados) + Residuos (`data/residuos.json`) | Desbloqueada por completo |
| 4 | Bus: `GtfsRepository` sobre el GTFS urbano real (`arandadeduero/gtfs-busurbano`) como fuente principal; GTFS interurbano del NAP como fuente secundaria | Desbloqueada por completo |
| 5 | Río: `RioClient` real contra la API SAIH-CHD aportada (§2.2b). Cortes de calles: **no se implementa** (Waze no disponible por ahora) — módulo omitido de la v1, no solo "stub" | Río desbloqueado; cortes de calles excluido de la v1 |
| 6 | Matomo + Prometheus + endpoints de transparencia (`/meta/fuentes`, `/meta/estado`) | Sin cambios |
| 7 | E2E, smoke tests, CI/CD, hardening | Sin cambios |

**Eventos y cortes de calles/Waze quedan explícitamente fuera de la v1** — no aparecen como módulos "pendientes", sino como decisión tomada de no implementarlos por ahora.

---

*No se ha escrito código de producción todavía. Se espera revisión de este documento y respuesta a las preguntas de §6 antes de iniciar la Fase 1, salvo indicación expresa de continuar automáticamente.*

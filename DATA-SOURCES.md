# Fuentes de datos

Resumen operativo. El detalle completo de la investigación (metodología,
verificaciones en vivo, tablas por campo) está en
[`docs/architecture-proposal.md`](docs/architecture-proposal.md) §2.

| Módulo                                        | Fuente                                                                    | Estado                                                             | Notas                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Weather                                       | Open-Meteo                                                                | ✅ Lista para implementar                                          | Sin API key, JSON, 10k llamadas/día (no comercial)                                                |
| Weather (avisos)                              | AEMET OpenData                                                            | ✅ Lista para implementar                                          | Requiere API key gratuita; renovar antes del 15-oct-2026 (keys sin expiración dejan de funcionar) |
| Ambiente (calidad del aire)                   | JCyL — Opendatasoft Explore v2.1                                          | ⚠️ API real y verificada, **pero sin estación en Aranda de Duero** | Pendiente decidir: estación más cercana con aviso, u omitir                                       |
| Farmacias                                     | Colegio Of. Farmacéuticos de Burgos (PDF mensual, zona "Aranda de Duero") | ⚠️ Requiere ingesta (no hay API)                                   | v1 usa fixture `data/farmacias.json` (pendiente, fase 2)                                          |
| Eventos                                       | Web municipal (`arandadeduero.es/servicio/eventos/`)                      | ❌ Sin API/RSS, HTML puro                                          | Pendiente decisión del usuario: ¿scraping propio? (ver docs/architecture-proposal.md §6.1)        |
| Parking / ORA                                 | Ayuntamiento (ordenanza, dato estático verificado)                        | ✅ Modelable como dataset estático                                 | Sin disponibilidad en tiempo real — `availabilityStatus: "NOT_AVAILABLE"`                         |
| Bus urbano                                    | —                                                                         | ❌ Sin GTFS público                                                | Pendiente de que el usuario aporte el fichero                                                     |
| Bus interurbano (Madrid–Aranda–Burgo de Osma) | NAP Transportes (GTFS, operador AISA)                                     | ✅ Real y disponible                                               | Buen primer caso de uso de `GtfsRepository` mientras no llega el urbano                           |
| Cortes de calles                              | Waze for Cities                                                           | ⚠️ Requiere alta institucional del Ayuntamiento                    | No es autoservicio para un desarrollador externo                                                  |
| Río                                           | CHD / SAIH Duero                                                          | ❌ Sin API pública documentada                                     | Adapter a construir en modo "stub" a la espera de fuente real                                     |
| Residuos / punto limpio                       | Ayuntamiento (dato estático)                                              | ✅ Modelable como dataset estático                                 | Sin API                                                                                           |

Leyenda: ✅ lista para implementar · ⚠️ requiere decisión o trabajo adicional · ❌ sin fuente estructurada todavía.

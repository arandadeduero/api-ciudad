/**
 * Catálogo estático de metadatos de fuentes de datos: procedencia, licencia,
 * frecuencia de actualización y fiabilidad. Sirve `GET /api/v1/meta/fuentes`
 * (§3 ítem 18 de docs/architecture-proposal.md — "transparencia total,
 * requisito explícito del prompt §32").
 *
 * Es el resumen operativo de DATA-SOURCES.md y docs/architecture-proposal.md
 * §2 expuesto como API: cualquier cambio a una fuente debe reflejarse aquí
 * en el mismo commit (misma regla que docs/API-REFERENCE.md).
 */
export type SourceStatus = 'implemented' | 'excluded';

export interface SourceMetadata {
  id: string;
  module: string;
  provider: string;
  sourceUrl: string | null;
  license: string;
  updateFrequency: string;
  reliability: string;
  status: SourceStatus;
  notes: string;
}

export const SOURCE_CATALOG: SourceMetadata[] = [
  {
    id: 'weather',
    module: 'Meteorología',
    provider: 'Open-Meteo',
    sourceUrl: 'https://open-meteo.com',
    license: 'CC BY 4.0 (uso no comercial gratuito, sin API key)',
    updateFrequency: 'Tiempo real (actualización horaria del modelo)',
    reliability: 'Alta',
    status: 'implemented',
    notes: 'Hasta 10.000 llamadas/día en el nivel gratuito.',
  },
  {
    id: 'ambiente',
    module: 'Calidad del aire',
    provider: 'Junta de Castilla y León — portal de datos abiertos (Opendatasoft)',
    sourceUrl:
      'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/calidad-del-aire-del-dia-en-curso',
    license: 'Reutilización libre (aviso legal de datos abiertos del sector público de JCyL)',
    updateFrequency: 'Horaria (dataset del día en curso); diaria agregada para histórico',
    reliability: 'Alta',
    status: 'implemented',
    notes:
      'Estación real "Aranda de Duero 2" (id 82) — corrige un error de la investigación inicial. Dos datasets distintos combinados en el mismo endpoint.',
  },
  {
    id: 'farmacia',
    module: 'Farmacias de guardia',
    provider: 'Colegio Oficial de Farmacéuticos de Burgos',
    sourceUrl: 'https://www.cofburgos.es',
    license: 'No especificada por la fuente — uso informativo',
    updateFrequency: 'Anual (calendario 2026 completo)',
    reliability:
      'Alta — re-verificado el 9-sept-2026 directamente contra el PDF oficial (14 fechas de confianza más baja documentadas)',
    status: 'implemented',
    notes:
      'Ver data/farmacias-guardia-2026.json → meta.caveat para el detalle de las fechas dudosas.',
  },
  {
    id: 'parking',
    module: 'Parking y zona ORA',
    provider: 'Ayuntamiento de Aranda de Duero (ordenanza municipal)',
    sourceUrl: null,
    license: 'Texto normativo público — libre reutilización como fuente de derecho',
    updateFrequency: 'Estática (ordenanza vigente desde 2021, BOP Burgos núm. 245, 28-dic-2021)',
    reliability: 'Alta — texto legal oficial',
    status: 'implemented',
    notes: 'Sin disponibilidad de plazas en tiempo real (availabilityStatus: "NOT_AVAILABLE").',
  },
  {
    id: 'residuos',
    module: 'Residuos y punto limpio',
    provider: 'Ayuntamiento de Aranda de Duero (Concejalía de Medio Ambiente / Aseo Urbano)',
    sourceUrl: null,
    license: 'No especificada — documento informativo municipal',
    updateFrequency: 'Estática (sin fecha de próxima revisión conocida)',
    reliability:
      'Alta para punto limpio, contenedores y contactos; media para el horario de cartón comercial (fuente secundaria, no confirmada en los PDF oficiales)',
    status: 'implemented',
    notes:
      'Recogida de enseres: Valoriza Servicios Medioambientales, S.A. (947 50 60 50) — corrige una mención previa errónea a "Urbaser".',
  },
  {
    id: 'bus',
    module: 'Bus urbano (L1/L2/L3)',
    provider: 'Ayuntamiento de Aranda de Duero / Dávila Autocares (feed GTFS)',
    sourceUrl: 'https://github.com/arandadeduero/gtfs-busurbano',
    license: 'AGPL-3.0 (declarada en el repositorio — verificar alcance antes de uso comercial)',
    updateFrequency: 'Releases automáticas vía GitHub Actions (frecuencia variable)',
    reliability: 'Alta',
    status: 'implemented',
    notes:
      'Sin servicio los domingos (confirmado en el propio feed). Caché en disco como resiliencia.',
  },
  {
    id: 'rio',
    module: 'Río (nivel y caudal)',
    provider: 'API de terceros sobre datos SAIH — Confederación Hidrográfica del Duero',
    sourceUrl: 'https://saih-chd-api-9d034ff9d037.herokuapp.com',
    license: 'No especificada — no es la API oficial de la CHD',
    updateFrequency: 'Casi tiempo real (ventana móvil de ~3 meses de histórico horario)',
    reliability: 'Media — servicio de terceros, sin SLA conocido',
    status: 'implemented',
    notes: 'Estación de aforo EA013. Solo nivel y caudal disponibles, no volumen.',
  },
  {
    id: 'embalse',
    module: 'Embalse (Linares del Arroyo)',
    provider: 'SAIH del Duero — Confederación Hidrográfica del Duero (ficha HTML pública)',
    sourceUrl: 'https://www.saihduero.es/ficha-risr?r=EM511',
    license: 'No especificada — no es una API oficial, es scraping de una ficha pública',
    updateFrequency: 'Casi tiempo real',
    reliability:
      'Media — sin API JSON estructurada; parser HTML real (no regex) sobre una página de un tercero',
    status: 'implemented',
    notes:
      'Estación EM511, en Maderuelo (Segovia), no en el municipio de Aranda — incluida por relevancia de cuenca del Duero.',
  },
  {
    id: 'educacion',
    module: 'Educación (centros docentes)',
    provider: 'Junta de Castilla y León — portal de datos abiertos (Opendatasoft)',
    sourceUrl:
      'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/directorio-de-centros-docentes',
    license: 'Reutilización libre (aviso legal de datos abiertos del sector público de JCyL)',
    updateFrequency: 'Por curso académico',
    reliability:
      'Alta — un registro con coordenada errónea del propio dataset, declarada como no disponible',
    status: 'implemented',
    notes: '27 centros reales confirmados en Aranda de Duero (públicos y privados).',
  },
  {
    id: 'bibliotecas',
    module: 'Bibliotecas',
    provider: 'Junta de Castilla y León — portal de datos abiertos (Opendatasoft)',
    sourceUrl:
      'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/bibliotecas-bibliobuses-y-puntos-de-servicio-movil-geolocalizados',
    license: 'Reutilización libre (aviso legal de datos abiertos del sector público de JCyL)',
    updateFrequency: 'Baja',
    reliability: 'Alta',
    status: 'implemented',
    notes: '1 registro real (Biblioteca Pública Municipal). No incluye horario de apertura.',
  },
  {
    id: 'avisos',
    module: 'Avisos meteorológicos',
    provider: 'AEMET — Agencia Estatal de Meteorología',
    sourceUrl: 'https://opendata.aemet.es',
    license: 'Aviso legal de AEMET OpenData — reutilización con atribución',
    updateFrequency: 'Tiempo real (según elaboración de AEMET)',
    reliability:
      'Alta — requiere API key gratuita; sin ella, el endpoint se degrada explícitamente',
    status: 'implemented',
    notes:
      'Zona "Meseta de Burgos" (670904), determinada por point-in-polygon contra el CAP-XML real, no asumida.',
  },
  {
    id: 'eventos',
    module: 'Eventos municipales',
    provider: 'Ayuntamiento de Aranda de Duero',
    sourceUrl: 'https://www.arandadeduero.es/servicio/eventos/',
    license: 'N/A',
    updateFrequency: 'N/A',
    reliability: 'N/A',
    status: 'excluded',
    notes:
      'Excluido de la v1 (decisión del usuario): HTML server-rendered en WordPress, sin API ni RSS.',
  },
  {
    id: 'cortescalles',
    module: 'Cortes de calles',
    provider: 'Waze for Cities',
    sourceUrl: null,
    license: 'N/A',
    updateFrequency: 'N/A',
    reliability: 'N/A',
    status: 'excluded',
    notes:
      'No disponible por ahora (decisión del usuario): requiere alta institucional del Ayuntamiento, sin trámite en curso.',
  },
];

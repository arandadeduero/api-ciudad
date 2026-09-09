import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { UpstreamError } from '../errors/AppError.js';
import type { AvisoFenomeno, AvisosSnapshot } from '../domain/avisos.js';

const parser = new XMLParser({ ignoreAttributes: true });

/**
 * AEMET publica cada fichero CAP-XML con dos `<info>` (es-ES/en-GB) y cada
 * `<info>` con un `<area>` por cada zona de la comunidad autónoma — cuando
 * solo hay uno, `fast-xml-parser` lo entrega como objeto suelto, no como
 * array de un elemento. Normalizar esto es imprescindible: sin `toArray()`
 * el código funcionaría hoy (Castilla y León siempre tiene decenas de
 * zonas) pero rompería en silencio para una comunidad con una sola zona.
 */
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const geocodeSchema = z.object({ valueName: z.string(), value: z.union([z.string(), z.number()]) });

const areaSchema = z
  .object({
    areaDesc: z.string(),
    geocode: z.union([geocodeSchema, z.array(geocodeSchema)]),
  })
  .passthrough();

const parameterSchema = z.object({
  valueName: z.string(),
  value: z.union([z.string(), z.number()]),
});

const infoSchema = z
  .object({
    language: z.string(),
    event: z.string(),
    severity: z.string(),
    headline: z.string(),
    effective: z.string(),
    onset: z.string().optional(),
    expires: z.string(),
    parameter: z.union([parameterSchema, z.array(parameterSchema)]).optional(),
    area: z.union([areaSchema, z.array(areaSchema)]),
  })
  .passthrough();

const capSchema = z.object({
  alert: z
    .object({
      info: z.union([infoSchema, z.array(infoSchema)]),
    })
    .passthrough(),
});

/**
 * Extrae el aviso (si lo hay) para una zona concreta de un único CAP-XML
 * (un fenómeno: viento, nieve, lluvia...). Devuelve `null` si la zona no
 * aparece en ninguno de los bloques `<info>` en español — no debería pasar
 * en la práctica (AEMET incluye todas las zonas de la CCAA en cada fichero,
 * casi siempre en "verde"), pero no se asume.
 */
export function parseAvisoXml(xml: string, zonaCodigo: string): AvisoFenomeno | null {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch (err) {
    throw new UpstreamError(
      `No se pudo parsear el CAP-XML de AEMET: ${(err as Error).message}`,
      'AVISOS_UNEXPECTED_SHAPE',
    );
  }

  const parsed = capSchema.safeParse(doc);
  if (!parsed.success) {
    throw new UpstreamError(
      `CAP-XML de AEMET con formato inesperado: ${parsed.error.issues[0]?.path.join('.')}`,
      'AVISOS_UNEXPECTED_SHAPE',
    );
  }

  const infosEs = toArray(parsed.data.alert.info).filter((info) => info.language === 'es-ES');

  for (const info of infosEs) {
    const areas = toArray(info.area);
    const matchesZona = areas.some((area) =>
      toArray(area.geocode).some((g) => String(g.value) === zonaCodigo),
    );
    if (!matchesZona) continue;

    const nivelParam = toArray(info.parameter).find(
      (p) => p.valueName === 'AEMET-Meteoalerta nivel',
    );

    return {
      fenomeno: info.event,
      nivel: nivelParam ? String(nivelParam.value) : 'desconocido',
      severity: info.severity,
      headline: info.headline,
      effective: info.effective,
      onset: info.onset ?? null,
      expires: info.expires,
    };
  }

  return null;
}

export function buildAvisosSnapshot(
  xmlFiles: string[],
  zona: { codigo: string; nombre: string },
  source: string,
): AvisosSnapshot {
  const avisos: AvisoFenomeno[] = [];
  for (const xml of xmlFiles) {
    const aviso = parseAvisoXml(xml, zona.codigo);
    if (aviso) avisos.push(aviso);
  }

  return {
    zona: zona.nombre,
    zonaCodigo: zona.codigo,
    avisos,
    hayAvisosActivos: avisos.some((a) => a.nivel !== 'verde'),
    source,
  };
}

import { z } from 'zod';
import { UpstreamError } from '../errors/AppError.js';
import { distanceMeters } from '../utils/geo.js';
import type { CentroEducativo } from '../domain/educacion.js';

/**
 * Radio máximo razonable alrededor del centro del municipio para aceptar la
 * coordenada del dataset de origen como fiable. JCyL trae al menos un
 * registro real con una coordenada claramente mal geocodificada (a ~67km,
 * cerca de Palencia, para un centro cuya dirección real es "Carretera de
 * Palencia" en Aranda — comprobado en vivo, 2026-09-09): en vez de inventar
 * una corrección, se declara `location: null` cuando la distancia excede
 * este umbral.
 */
const MAX_DISTANCE_FROM_CENTER_METERS = 20_000;

const centroRecordSchema = z.object({
  codigo: z.string(),
  denominacion_especifica: z.string(),
  denominacion_generica: z.string(),
  denominacion_generica_breve: z.string(),
  naturaleza: z.string(),
  via: z.string().nullable(),
  nombre_de_la_via: z.string(),
  numero: z.number().nullable(),
  c_postal: z.number().nullable(),
  telefono: z.number().nullable(),
  correo_electronico: z.string().nullable(),
  web: z.string().nullable(),
  coord_latitud: z.number().nullable(),
  coord_longitud: z.number().nullable(),
  jornada_continua: z.string(),
  comedor: z.string(),
  transporte: z.string(),
});

function buildDireccion(rec: z.infer<typeof centroRecordSchema>): string {
  const via = rec.via ? `${rec.via} ` : '';
  const numero = rec.numero !== null ? `, ${rec.numero}` : '';
  return `${via}${rec.nombre_de_la_via}${numero}`.trim();
}

export function toCentroEducativo(
  raw: unknown,
  centerOfTown: { latitude: number; longitude: number },
): CentroEducativo {
  const parsed = centroRecordSchema.safeParse(raw);
  if (!parsed.success) {
    throw new UpstreamError(
      `Respuesta de JCyL (centros docentes) con formato inesperado: ${parsed.error.issues[0]?.path.join('.')}`,
      'JCYL_UNEXPECTED_SHAPE',
    );
  }
  const rec = parsed.data;

  let location: { latitude: number; longitude: number } | null = null;
  if (rec.coord_latitud !== null && rec.coord_longitud !== null) {
    const candidate = { latitude: rec.coord_latitud, longitude: rec.coord_longitud };
    if (distanceMeters(centerOfTown, candidate) <= MAX_DISTANCE_FROM_CENTER_METERS) {
      location = candidate;
    }
  }

  return {
    codigo: rec.codigo,
    nombre: rec.denominacion_especifica,
    tipo: rec.denominacion_generica,
    tipoBreve: rec.denominacion_generica_breve,
    naturaleza: rec.naturaleza,
    direccion: buildDireccion(rec),
    codigoPostal: rec.c_postal !== null ? String(rec.c_postal).padStart(5, '0') : null,
    telefono: rec.telefono !== null ? String(rec.telefono) : null,
    correoElectronico: rec.correo_electronico,
    web: rec.web,
    location,
    jornadaContinua: rec.jornada_continua === 'S',
    comedor: rec.comedor === 'S',
    transporteEscolar: rec.transporte === 'S',
  };
}

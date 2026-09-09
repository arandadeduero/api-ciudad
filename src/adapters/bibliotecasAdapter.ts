import { z } from 'zod';
import { UpstreamError } from '../errors/AppError.js';
import type { Biblioteca } from '../domain/bibliotecas.js';

const bibliotecaRecordSchema = z.object({
  codigo_biblioteca: z.string(),
  nombre_entidad: z.string(),
  tipo: z.string(),
  direccion: z.string(),
  localidad: z.string(),
  provincia: z.string(),
  enlace_contenido: z.string().nullable(),
  // `geo_point_2d` en la API Opendatasoft: siempre {lat, lon} numéricos
  // cuando el registro tiene coordenadas (a diferencia de `latitud`/
  // `longitud_final`, que el propio dataset tipa como texto).
  posicion: z.object({ lat: z.number(), lon: z.number() }).nullable(),
});

export function toBiblioteca(raw: unknown): Biblioteca {
  const parsed = bibliotecaRecordSchema.safeParse(raw);
  if (!parsed.success) {
    throw new UpstreamError(
      `Respuesta de JCyL (bibliotecas) con formato inesperado: ${parsed.error.issues[0]?.path.join('.')}`,
      'JCYL_UNEXPECTED_SHAPE',
    );
  }
  const rec = parsed.data;

  return {
    codigo: rec.codigo_biblioteca,
    nombre: rec.nombre_entidad,
    tipo: rec.tipo,
    direccion: rec.direccion,
    localidad: rec.localidad,
    provincia: rec.provincia,
    location: rec.posicion ? { latitude: rec.posicion.lat, longitude: rec.posicion.lon } : null,
    enlace: rec.enlace_contenido,
  };
}

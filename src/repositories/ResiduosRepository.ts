import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { z } from 'zod';
import type {
  AtencionCiudadana,
  ComercioCarton,
  Contenedor,
  Enseres,
  PuntoLimpio,
} from '../domain/residuos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

const horarioBloqueSchema = z.object({ periodo: z.string(), desde: z.string(), hasta: z.string() });

const residuosFileSchema = z.object({
  meta: z.object({}).passthrough(),
  puntoLimpio: z.object({
    operador: z.string(),
    direccion: z.string(),
    usuarios: z.string(),
    horario: z.object({
      lunesAViernes: z.array(horarioBloqueSchema),
      sabado: z.array(horarioBloqueSchema),
      excepciones: z.string(),
    }),
  }),
  contenedores: z.array(
    z.object({
      tipo: z.string(),
      color: z.string().nullable(),
      descripcion: z.string(),
      instrucciones: z.string().nullable(),
      horarioDeposito: z.object({ desde: z.string(), hasta: z.string() }).nullable(),
    }),
  ),
  enseres: z.object({
    descripcion: z.string(),
    metodo: z.string(),
    operador: z.string(),
    telefono: z.string(),
  }),
  comercioCarton: z.object({
    descripcion: z.string(),
    horario: z.object({ diasSemana: z.string(), desde: z.string(), hasta: z.string() }),
    instrucciones: z.string(),
    sancionPorIncumplimiento: z.string(),
    fuente: z.string(),
  }),
  atencionCiudadana: z.object({
    telefono: z.string(),
    horario: z.object({ desde: z.string(), hasta: z.string() }),
    sedeElectronica: z.string(),
    correo: z.string(),
    oficinas: z.array(z.object({ nombre: z.string(), direccion: z.string() })),
  }),
});

export interface ResiduosData {
  puntoLimpio: PuntoLimpio;
  contenedores: Contenedor[];
  enseres: Enseres;
  comercioCarton: ComercioCarton;
  atencionCiudadana: AtencionCiudadana;
}

/** Repositorio de residuos: dataset estático real (2 PDF oficiales), ver DATA-SOURCES.md. */
export class ResiduosRepository {
  private cache: Promise<ResiduosData> | undefined;

  private async load(): Promise<ResiduosData> {
    const raw = await readFile(join(DATA_DIR, 'residuos.json'), 'utf-8');
    return residuosFileSchema.parse(JSON.parse(raw));
  }

  async get(): Promise<ResiduosData> {
    if (!this.cache) this.cache = this.load();
    return this.cache;
  }
}

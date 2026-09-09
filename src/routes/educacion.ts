import type { FastifyInstance } from 'fastify';
import type { EducacionService } from '../services/EducacionService.js';
import { responseSchema } from './schemas.js';

function envelope<T>(data: T, stale: boolean) {
  return {
    data,
    meta: {
      source: 'JCyL — Datos Abiertos (dataset: directorio-de-centros-docentes)',
      retrievedAt: new Date().toISOString(),
      cached: false,
      ...(stale ? { stale: true } : {}),
    },
  };
}

const centroSchemaDef = {
  type: 'object',
  properties: {
    codigo: { type: 'string' },
    nombre: { type: 'string' },
    tipo: { type: 'string' },
    tipoBreve: { type: 'string' },
    naturaleza: { type: 'string', description: '"PUBLICO" o "PRIVADO".' },
    direccion: { type: 'string' },
    codigoPostal: { type: 'string', nullable: true },
    telefono: { type: 'string', nullable: true },
    correoElectronico: { type: 'string', nullable: true },
    web: { type: 'string', nullable: true },
    location: {
      type: 'object',
      nullable: true,
      description:
        'null si la coordenada del dataset de origen cae fuera de un radio razonable del municipio (dato de origen con error de geocodificación conocido) — nunca se inventa una coordenada corregida.',
      properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
    },
    jornadaContinua: { type: 'boolean' },
    comedor: { type: 'boolean' },
    transporteEscolar: { type: 'boolean' },
  },
} as const;

export async function educacionRoutes(
  app: FastifyInstance,
  opts: { service: EducacionService },
): Promise<void> {
  const { service } = opts;

  app.get(
    '/educacion/centros',
    {
      schema: {
        tags: ['educacion'],
        summary: 'Centros educativos de Aranda de Duero (públicos y privados)',
        description:
          'Fuente: directorio oficial de centros docentes de la Junta de Castilla y León. Incluye colegios, institutos, escuela oficial de idiomas y escuela infantil municipal.',
        response: responseSchema({ type: 'array', items: centroSchemaDef }),
      },
    },
    async () => {
      const { data, stale } = await service.listCentros();
      return envelope(data, stale);
    },
  );

  app.get(
    '/educacion/centros/:codigo',
    {
      schema: {
        tags: ['educacion'],
        summary: 'Detalle de un centro educativo por código',
        params: {
          type: 'object',
          properties: {
            codigo: {
              type: 'string',
              description: 'Código de centro (ver GET /educacion/centros), p. ej. "09000239".',
            },
          },
          required: ['codigo'],
        },
        response: responseSchema(centroSchemaDef),
      },
    },
    async (request) => {
      const { codigo } = request.params as { codigo: string };
      const { data, stale } = await service.getCentro(codigo);
      return envelope(data, stale);
    },
  );
}

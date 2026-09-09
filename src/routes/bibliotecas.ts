import type { FastifyInstance } from 'fastify';
import type { BibliotecasService } from '../services/BibliotecasService.js';
import { responseSchema } from './schemas.js';

function envelope<T>(data: T, stale: boolean) {
  return {
    data,
    meta: {
      source:
        'JCyL — Datos Abiertos (dataset: bibliotecas-bibliobuses-y-puntos-de-servicio-movil-geolocalizados)',
      retrievedAt: new Date().toISOString(),
      cached: false,
      ...(stale ? { stale: true } : {}),
    },
  };
}

const bibliotecaSchemaDef = {
  type: 'object',
  properties: {
    codigo: { type: 'string' },
    nombre: { type: 'string' },
    tipo: { type: 'string' },
    direccion: { type: 'string' },
    localidad: { type: 'string' },
    provincia: { type: 'string' },
    location: {
      type: 'object',
      nullable: true,
      properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
    },
    enlace: {
      type: 'string',
      nullable: true,
      description:
        'Ficha oficial en bibliotecas.jcyl.es. No incluye horario de apertura — el dataset de origen no lo trae.',
    },
  },
} as const;

export async function bibliotecasRoutes(
  app: FastifyInstance,
  opts: { service: BibliotecasService },
): Promise<void> {
  const { service } = opts;

  app.get(
    '/bibliotecas',
    {
      schema: {
        tags: ['bibliotecas'],
        summary: 'Bibliotecas públicas de Aranda de Duero',
        description:
          'Fuente: directorio geolocalizado de bibliotecas de la Junta de Castilla y León. No incluye horario de apertura, solo localización y contacto.',
        response: responseSchema({ type: 'array', items: bibliotecaSchemaDef }),
      },
    },
    async () => {
      const { data, stale } = await service.listBibliotecas();
      return envelope(data, stale);
    },
  );
}

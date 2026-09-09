import type { FastifyInstance } from 'fastify';
import type { ResiduosService } from '../services/ResiduosService.js';
import { responseSchema } from './schemas.js';

function envelope<T>(data: T) {
  return {
    data,
    meta: {
      source: 'Ayuntamiento de Aranda de Duero — Concejalía de Medio Ambiente / Aseo Urbano',
      retrievedAt: new Date().toISOString(),
      cached: false,
    },
  };
}

const horarioBloqueSchemaDef = {
  type: 'object',
  properties: {
    periodo: { type: 'string', description: 'Ej. "mañana" o "tarde".' },
    desde: { type: 'string', description: 'Hora de apertura, formato HH:MM.' },
    hasta: { type: 'string', description: 'Hora de cierre, formato HH:MM.' },
  },
} as const;

const puntoLimpioSchemaDef = {
  type: 'object',
  properties: {
    operador: { type: 'string' },
    direccion: { type: 'string' },
    usuarios: {
      type: 'string',
      description: 'A quién presta servicio (p. ej. "Solo particulares").',
    },
    horario: {
      type: 'object',
      properties: {
        lunesAViernes: { type: 'array', items: horarioBloqueSchemaDef },
        sabado: { type: 'array', items: horarioBloqueSchemaDef },
        excepciones: { type: 'string' },
      },
    },
  },
} as const;

const contenedorSchemaDef = {
  type: 'object',
  properties: {
    tipo: {
      type: 'string',
      description:
        'Identificador estable usado también como :tipo en /residuos/contenedores/:tipo (p. ej. "vidrio").',
    },
    color: { type: 'string', nullable: true },
    descripcion: { type: 'string' },
    instrucciones: { type: 'string', nullable: true },
    horarioDeposito: {
      type: 'object',
      nullable: true,
      description:
        'Franja horaria en la que puede depositarse este residuo. null si no hay restricción horaria documentada (la mayoría de tipos).',
      properties: {
        desde: { type: 'string', description: 'HH:MM' },
        hasta: { type: 'string', description: 'HH:MM' },
      },
    },
  },
} as const;

const enseresSchemaDef = {
  type: 'object',
  properties: {
    descripcion: { type: 'string' },
    metodo: { type: 'string' },
    operador: { type: 'string' },
    telefono: { type: 'string' },
  },
} as const;

const comercioCartonSchemaDef = {
  type: 'object',
  properties: {
    descripcion: { type: 'string' },
    horario: {
      type: 'object',
      properties: {
        diasSemana: { type: 'string' },
        desde: { type: 'string', description: 'HH:MM' },
        hasta: { type: 'string', description: 'HH:MM' },
      },
    },
    instrucciones: { type: 'string' },
    sancionPorIncumplimiento: { type: 'string' },
    fuente: {
      type: 'string',
      description:
        'Procedencia del dato. Este es el único dato de todo el proyecto marcado como fuente secundaria (nota de prensa, no un PDF oficial del Ayuntamiento) — ver docs/API-REFERENCE.md.',
    },
  },
} as const;

const atencionCiudadanaSchemaDef = {
  type: 'object',
  properties: {
    telefono: { type: 'string' },
    horario: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'HH:MM' },
        hasta: { type: 'string', description: 'HH:MM' },
      },
    },
    sedeElectronica: { type: 'string' },
    correo: { type: 'string' },
    oficinas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { nombre: { type: 'string' }, direccion: { type: 'string' } },
      },
    },
  },
} as const;

export async function residuosRoutes(
  app: FastifyInstance,
  opts: { service: ResiduosService },
): Promise<void> {
  const { service } = opts;

  app.get(
    '/residuos/puntolimpio',
    {
      schema: {
        tags: ['residuos'],
        summary: 'Horario y ubicación del Punto Limpio',
        description:
          'Punto Limpio del Consorcio Provincial de Residuos Urbanos de Burgos, solo para particulares (no admite residuos de actividad comercial).',
        response: responseSchema(puntoLimpioSchemaDef),
      },
    },
    async () => envelope(await service.getPuntoLimpio()),
  );

  app.get(
    '/residuos/contenedores',
    {
      schema: {
        tags: ['residuos'],
        summary: 'Tipos de contenedor y horario de depósito donde aplica',
        description:
          'Los 9 tipos de contenedor de recogida selectiva del municipio. Solo "vidrio" y "resto" tienen horarioDeposito documentado; el resto puede depositarse sin restricción horaria.',
        response: responseSchema({ type: 'array', items: contenedorSchemaDef }),
      },
    },
    async () => envelope(await service.listContenedores()),
  );

  app.get(
    '/residuos/contenedores/:tipo',
    {
      schema: {
        tags: ['residuos'],
        summary: 'Detalle de un tipo de contenedor',
        params: {
          type: 'object',
          properties: {
            tipo: {
              type: 'string',
              description:
                'Identificador del tipo (ver GET /residuos/contenedores), p. ej. "vidrio", "papel_carton", "organica".',
            },
          },
          required: ['tipo'],
        },
        response: responseSchema(contenedorSchemaDef),
      },
    },
    async (request) => {
      const { tipo } = request.params as { tipo: string };
      return envelope(await service.getContenedor(tipo));
    },
  );

  app.get(
    '/residuos/enseres',
    {
      schema: {
        tags: ['residuos'],
        summary: 'Recogida de muebles y enseres voluminosos',
        description: 'Recogida a domicilio previa solicitud telefónica, gestionada por Valoriza.',
        response: responseSchema(enseresSchemaDef),
      },
    },
    async () => envelope(await service.getEnseres()),
  );

  app.get(
    '/residuos/comercio-carton',
    {
      schema: {
        tags: ['residuos'],
        summary: 'Recogida puerta a puerta de cartón comercial',
        description:
          'Para locales y establecimientos de hostelería con volumen significativo de cartón. Dato marcado como fuente secundaria (ver campo "fuente" en la respuesta).',
        response: responseSchema(comercioCartonSchemaDef),
      },
    },
    async () => envelope(await service.getComercioCarton()),
  );

  app.get(
    '/residuos/atencion-ciudadana',
    {
      schema: {
        tags: ['residuos'],
        summary: 'Contacto y oficinas de atención ciudadana en materia de residuos',
        description:
          'Teléfono, horario, sede electrónica, correo y oficinas físicas de Medio Ambiente / Valoriza para consultas de residuos.',
        response: responseSchema(atencionCiudadanaSchemaDef),
      },
    },
    async () => envelope(await service.getAtencionCiudadana()),
  );
}

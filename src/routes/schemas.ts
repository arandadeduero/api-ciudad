/**
 * Piezas de JSON Schema compartidas entre módulos de rutas. El `response`
 * schema de Fastify actúa como whitelist de serialización: cualquier
 * propiedad no declarada se descarta en silencio, así que toda ruta que
 * declare un `response` debe envolver su `data` con `responseSchema()`
 * para no perder el envoltorio `meta` (§14 del prompt maestro).
 */
export const metaSchemaDef = {
  type: 'object',
  properties: {
    source: { type: 'string' },
    retrievedAt: { type: 'string' },
    cached: { type: 'boolean' },
    stale: { type: 'boolean' },
  },
} as const;

export function responseSchema(dataSchema: object) {
  return { 200: { type: 'object', properties: { data: dataSchema, meta: metaSchemaDef } } };
}

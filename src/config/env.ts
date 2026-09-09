import { z } from 'zod';

/**
 * Esquema de variables de entorno.
 *
 * Solo las variables que el código de esta fase consume realmente son
 * obligatorias. Las variables de fuentes externas que aún no están
 * implementadas (ver docs/architecture-proposal.md) se documentan en
 * .env.example pero no se validan aquí como requeridas: exigirlas ahora
 * haría fallar el arranque por configuración que todavía no se usa.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  CORS_ORIGIN: z.string().default('*'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  CACHE_DRIVER: z.enum(['memory', 'redis']).default('memory'),
  REDIS_URL: z.string().url().optional(),

  // Weather (Fase 2 — Open-Meteo)
  OPEN_METEO_BASE_URL: z.string().url().default('https://api.open-meteo.com/v1'),
  OPEN_METEO_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  WEATHER_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  // Coordenadas por defecto: Plaza Mayor de Aranda de Duero (ver data/farmacias.json geocode).
  ARANDA_LATITUDE: z.coerce.number().default(41.6701895),
  ARANDA_LONGITUDE: z.coerce.number().default(-3.6885626),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // FAIL FAST: no arrancamos con configuración inválida o incompleta.
    // eslint-disable-next-line no-console
    console.error('❌ Configuración de entorno inválida:');
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  const env = parsed.data;

  if (env.CACHE_DRIVER === 'redis' && !env.REDIS_URL) {
    // eslint-disable-next-line no-console
    console.error('❌ CACHE_DRIVER=redis requiere REDIS_URL configurado.');
    process.exit(1);
  }

  return env;
}

export const env = loadEnv();

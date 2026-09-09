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

  // Ambiente (Fase 3 — JCyL Opendatasoft)
  JCYL_OPENDATA_BASE_URL: z
    .string()
    .url()
    .default('https://analisis.datosabiertos.jcyl.es/api/explore/v2.1'),
  JCYL_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  JCYL_AIR_QUALITY_DATASET_TODAY: z.string().default('calidad-del-aire-del-dia-en-curso'),
  JCYL_AIR_QUALITY_DATASET_HISTORICAL: z
    .string()
    .default('calidad-del-aire-datos-historicos-diarios'),
  JCYL_AIR_QUALITY_STATION: z.string().default('Aranda de Duero 2'),
  JCYL_AIR_QUALITY_STATION_ID: z.coerce.number().int().positive().default(82),
  JCYL_AIR_QUALITY_PROVINCE: z.string().default('Burgos'),
  AMBIENTE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  // Bus urbano (Fase 4 — GTFS real vía GitHub Releases)
  GTFS_URBANO_REPO: z.string().default('arandadeduero/gtfs-busurbano'),
  GTFS_URBANO_CACHE_DIR: z.string().default('./data/gtfs-urbano'),
  GTFS_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // Río (Fase 5 — API de terceros sobre datos SAIH-CHD, ver docs/architecture-proposal.md §2.2b)
  RIVER_API_BASE_URL: z.string().url().default('https://saih-chd-api-9d034ff9d037.herokuapp.com'),
  RIVER_STATION_CODE: z.string().default('EA013'),
  RIVER_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
  RIVER_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  // Matomo (Fase 6 — tracking best-effort, ver src/services/MatomoService.ts)
  // NOTA: no se usa z.coerce.boolean() a propósito — Boolean("false") es
  // `true` en JS, así que ese coercer trataría cualquier string no vacío
  // (incluido literalmente "false") como activado.
  MATOMO_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  MATOMO_URL: z.string().default(''),
  MATOMO_SITE_ID: z.string().default(''),
  MATOMO_TOKEN: z.string().default(''),
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

import { env } from '../config/env.js';
import type { CacheService } from './CacheService.js';
import { InMemoryCache } from './InMemoryCache.js';

/**
 * Factoría del CacheService activo, seleccionado por CACHE_DRIVER.
 *
 * RedisCache no está implementado todavía: no hay necesidad real de cache
 * compartida entre instancias hasta que la API corra en más de un proceso
 * (ver docs/architecture-proposal.md §5 — decisión deliberada de no
 * sobre-ingenierizar). Cuando se implemente, solo cambia esta factoría.
 */
export function createCacheService(): CacheService {
  if (env.CACHE_DRIVER === 'redis') {
    throw new Error(
      'CACHE_DRIVER=redis todavía no está implementado (RedisCache pendiente). Usa CACHE_DRIVER=memory.',
    );
  }
  return new InMemoryCache();
}

export type { CacheService } from './CacheService.js';

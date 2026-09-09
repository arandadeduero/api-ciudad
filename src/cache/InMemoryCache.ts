import type { CacheService } from './CacheService.js';
import { cacheHitsTotal, cacheMissesTotal, cacheDomainFromKey } from '../telemetry/metrics.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Implementación en memoria del CacheService. Es el driver por defecto
 * (CACHE_DRIVER=memory): suficiente mientras la API corra en una única
 * instancia. El contrato es idéntico al que tendrá RedisCache cuando se
 * añada (fase en la que haya más de una instancia del proceso).
 */
export class InMemoryCache implements CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | undefined> {
    const domain = cacheDomainFromKey(key);
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      cacheMissesTotal.inc({ domain });
      return undefined;
    }
    cacheHitsTotal.inc({ domain });
    return entry.value as T;
  }

  async getStale<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    return entry?.value as T | undefined;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

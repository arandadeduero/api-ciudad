/**
 * Abstracción de cache. Los servicios de dominio (WeatherService,
 * AirQualityService, etc. — fases 2+) dependen únicamente de esta interfaz,
 * nunca de la implementación concreta, para poder pasar de memoria a Redis
 * sin tocar la capa de servicios (ver docs/architecture-proposal.md §4.3).
 */
export interface CacheService {
  /** Devuelve el valor si existe y no ha expirado. */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Devuelve el valor aunque haya expirado, siempre que exista una entrada
   * previa. Es la base del patrón "stale-while-error": si una fuente externa
   * falla, el Service puede servir el último dato conocido marcándolo como
   * `stale` en vez de propagar un 5xx.
   */
  getStale<T>(key: string): Promise<T | undefined>;

  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  delete(key: string): Promise<void>;

  clear(): Promise<void>;
}

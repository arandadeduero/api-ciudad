import type { EmbalseProvider } from '../clients/SaihDueroEmbalseClient.js';
import type { EmbalseSnapshot } from '../domain/embalse.js';
import type { CacheService } from '../cache/CacheService.js';
import { UpstreamError } from '../errors/AppError.js';

export interface EmbalseResult {
  data: EmbalseSnapshot;
  stale: boolean;
}

export class EmbalseService {
  constructor(
    private readonly client: EmbalseProvider,
    private readonly cache: CacheService,
    private readonly stationCode: string,
    private readonly ttlSeconds: number,
  ) {}

  async getSnapshot(): Promise<EmbalseResult> {
    const cacheKey = `embalse:${this.stationCode}`;
    const cached = await this.cache.get<EmbalseSnapshot>(cacheKey);
    if (cached) return { data: cached, stale: false };

    try {
      const snapshot = await this.client.fetchEmbalse(this.stationCode);
      await this.cache.set(cacheKey, snapshot, this.ttlSeconds);
      return { data: snapshot, stale: false };
    } catch (err) {
      const stale = await this.cache.getStale<EmbalseSnapshot>(cacheKey);
      if (stale) return { data: stale, stale: true };
      throw err instanceof UpstreamError
        ? err
        : new UpstreamError('No se pudo obtener el dato del embalse.', 'EMBALSE_UNAVAILABLE');
    }
  }
}

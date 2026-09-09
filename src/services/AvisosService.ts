import type { AvisosProvider } from '../clients/AemetAvisosClient.js';
import { buildAvisosSnapshot } from '../adapters/avisosAdapter.js';
import type { AvisosSnapshot } from '../domain/avisos.js';
import type { CacheService } from '../cache/CacheService.js';
import { UpstreamError } from '../errors/AppError.js';

export interface AvisosResult {
  data: AvisosSnapshot;
  stale: boolean;
}

const SOURCE = 'AEMET OpenData — Avisos de Fenómenos Meteorológicos Adversos';
const CACHE_KEY = 'avisos:snapshot';

export interface AvisosZonaConfig {
  area: string;
  zonaCodigo: string;
  zonaNombre: string;
}

export class AvisosService {
  constructor(
    private readonly client: AvisosProvider,
    private readonly cache: CacheService,
    private readonly zona: AvisosZonaConfig,
    private readonly ttlSeconds: number,
  ) {}

  async getSnapshot(): Promise<AvisosResult> {
    const cached = await this.cache.get<AvisosSnapshot>(CACHE_KEY);
    if (cached) return { data: cached, stale: false };

    try {
      const xmlFiles = await this.client.fetchAvisos(this.zona.area);
      const snapshot = buildAvisosSnapshot(
        xmlFiles,
        { codigo: this.zona.zonaCodigo, nombre: this.zona.zonaNombre },
        SOURCE,
      );
      await this.cache.set(CACHE_KEY, snapshot, this.ttlSeconds);
      return { data: snapshot, stale: false };
    } catch (err) {
      const stale = await this.cache.getStale<AvisosSnapshot>(CACHE_KEY);
      if (stale) return { data: stale, stale: true };
      throw err instanceof UpstreamError
        ? err
        : new UpstreamError(
            'No se pudieron obtener los avisos meteorológicos.',
            'AVISOS_UNAVAILABLE',
          );
    }
  }
}

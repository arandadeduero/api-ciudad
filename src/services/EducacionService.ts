import type { JcylProvider } from '../clients/JcylClient.js';
import { toCentroEducativo } from '../adapters/educacionAdapter.js';
import type { CentroEducativo } from '../domain/educacion.js';
import type { CacheService } from '../cache/CacheService.js';
import { NotFoundError, UpstreamError } from '../errors/AppError.js';

export interface EducacionResult<T> {
  data: T;
  stale: boolean;
}

const CACHE_KEY = 'educacion:centros';

export class EducacionService {
  constructor(
    private readonly client: JcylProvider,
    private readonly cache: CacheService,
    private readonly dataset: string,
    private readonly municipio: string,
    private readonly centerOfTown: { latitude: number; longitude: number },
    private readonly ttlSeconds: number,
  ) {}

  private async getAll(): Promise<EducacionResult<CentroEducativo[]>> {
    const cached = await this.cache.get<CentroEducativo[]>(CACHE_KEY);
    if (cached) return { data: cached, stale: false };

    try {
      const raw = await this.client.fetchAllRecords(this.dataset, { municipio: this.municipio });
      const centros = raw.map((r) => toCentroEducativo(r, this.centerOfTown));
      await this.cache.set(CACHE_KEY, centros, this.ttlSeconds);
      return { data: centros, stale: false };
    } catch (err) {
      const stale = await this.cache.getStale<CentroEducativo[]>(CACHE_KEY);
      if (stale) return { data: stale, stale: true };
      throw err instanceof UpstreamError
        ? err
        : new UpstreamError(
            'No se pudo obtener el listado de centros educativos.',
            'EDUCACION_UNAVAILABLE',
          );
    }
  }

  async listCentros(): Promise<EducacionResult<CentroEducativo[]>> {
    return this.getAll();
  }

  async getCentro(codigo: string): Promise<EducacionResult<CentroEducativo>> {
    const { data: centros, stale } = await this.getAll();
    const centro = centros.find((c) => c.codigo === codigo);
    if (!centro) {
      throw new NotFoundError(`No existe ningún centro educativo con código "${codigo}".`);
    }
    return { data: centro, stale };
  }
}

import type { JcylProvider } from '../clients/JcylClient.js';
import { toBiblioteca } from '../adapters/bibliotecasAdapter.js';
import type { Biblioteca } from '../domain/bibliotecas.js';
import type { CacheService } from '../cache/CacheService.js';
import { UpstreamError } from '../errors/AppError.js';

export interface BibliotecasResult {
  data: Biblioteca[];
  stale: boolean;
}

const CACHE_KEY = 'bibliotecas:localidad';

export class BibliotecasService {
  constructor(
    private readonly client: JcylProvider,
    private readonly cache: CacheService,
    private readonly dataset: string,
    private readonly localidad: string,
    private readonly ttlSeconds: number,
  ) {}

  async listBibliotecas(): Promise<BibliotecasResult> {
    const cached = await this.cache.get<Biblioteca[]>(CACHE_KEY);
    if (cached) return { data: cached, stale: false };

    try {
      const raw = await this.client.fetchAllRecords(this.dataset, { localidad: this.localidad });
      const bibliotecas = raw.map(toBiblioteca);
      await this.cache.set(CACHE_KEY, bibliotecas, this.ttlSeconds);
      return { data: bibliotecas, stale: false };
    } catch (err) {
      const stale = await this.cache.getStale<Biblioteca[]>(CACHE_KEY);
      if (stale) return { data: stale, stale: true };
      throw err instanceof UpstreamError
        ? err
        : new UpstreamError(
            'No se pudo obtener el listado de bibliotecas.',
            'BIBLIOTECAS_UNAVAILABLE',
          );
    }
  }
}

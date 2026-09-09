import { describe, expect, it, vi } from 'vitest';
import { BibliotecasService } from '../../src/services/BibliotecasService.js';
import { InMemoryCache } from '../../src/cache/InMemoryCache.js';
import type { JcylProvider } from '../../src/clients/JcylClient.js';
import { UpstreamError } from '../../src/errors/AppError.js';

function rawBiblioteca() {
  return {
    codigo_biblioteca: 'ADUER',
    nombre_entidad: 'Biblioteca Pública Municipal de Aranda de Duero',
    tipo: 'Biblioteca',
    direccion: 'Plaza del Trigo 9',
    localidad: 'Aranda de Duero',
    provincia: 'Burgos',
    enlace_contenido: 'https://bibliotecas.jcyl.es/...',
    posicion: { lat: 41.6719, lon: -3.6875 },
  };
}

function makeProvider(records: unknown[], opts: { fail?: boolean } = {}): JcylProvider {
  return {
    fetchAllRecords: vi.fn(async () => {
      if (opts.fail) throw new UpstreamError('boom', 'TEST_FAILURE');
      return records;
    }),
  };
}

describe('BibliotecasService', () => {
  it('listBibliotecas cachea la respuesta y filtra por localidad', async () => {
    const provider = makeProvider([rawBiblioteca()]);
    const service = new BibliotecasService(
      provider,
      new InMemoryCache(),
      'ds',
      'Aranda de Duero',
      600,
    );

    const result = await service.listBibliotecas();
    await service.listBibliotecas();

    expect(provider.fetchAllRecords).toHaveBeenCalledTimes(1);
    expect(provider.fetchAllRecords).toHaveBeenCalledWith('ds', { localidad: 'Aranda de Duero' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.nombre).toContain('Biblioteca Pública Municipal');
    expect(result.data[0]!.location).toEqual({ latitude: 41.6719, longitude: -3.6875 });
  });

  it('sirve caché obsoleta si JCyL falla tras un éxito previo', async () => {
    vi.useFakeTimers();
    try {
      const provider = makeProvider([rawBiblioteca()]);
      const cache = new InMemoryCache();
      const service = new BibliotecasService(provider, cache, 'ds', 'Aranda de Duero', 1);
      await service.listBibliotecas();
      vi.advanceTimersByTime(1_100);

      const failingProvider = makeProvider([], { fail: true });
      const failingService = new BibliotecasService(
        failingProvider,
        cache,
        'ds',
        'Aranda de Duero',
        1,
      );
      const result = await failingService.listBibliotecas();
      expect(result.stale).toBe(true);
      expect(result.data).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('propaga UpstreamError si no hay caché previa y la fuente falla', async () => {
    const provider = makeProvider([], { fail: true });
    const service = new BibliotecasService(
      provider,
      new InMemoryCache(),
      'ds',
      'Aranda de Duero',
      600,
    );
    await expect(service.listBibliotecas()).rejects.toBeInstanceOf(UpstreamError);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { EducacionService } from '../../src/services/EducacionService.js';
import { InMemoryCache } from '../../src/cache/InMemoryCache.js';
import type { JcylProvider } from '../../src/clients/JcylClient.js';
import { NotFoundError, UpstreamError } from '../../src/errors/AppError.js';

const centerOfTown = { latitude: 41.6701895, longitude: -3.6885626 };

function rawCentro(codigo: string, nombre: string) {
  return {
    codigo,
    denominacion_especifica: nombre,
    denominacion_generica: 'COLEGIO',
    denominacion_generica_breve: 'Colegio',
    naturaleza: 'PUBLICO',
    via: 'CALLE',
    nombre_de_la_via: 'MAYOR',
    numero: 1,
    c_postal: 9400,
    telefono: 947500000,
    correo_electronico: null,
    web: null,
    coord_latitud: 41.67,
    coord_longitud: -3.6886,
    jornada_continua: 'S',
    comedor: 'N',
    transporte: 'N',
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

describe('EducacionService', () => {
  it('listCentros cachea la respuesta tras la primera llamada', async () => {
    const provider = makeProvider([rawCentro('1', 'Uno')]);
    const service = new EducacionService(
      provider,
      new InMemoryCache(),
      'ds',
      'ARANDA DE DUERO',
      centerOfTown,
      600,
    );

    await service.listCentros();
    await service.listCentros();
    expect(provider.fetchAllRecords).toHaveBeenCalledTimes(1);
    expect(provider.fetchAllRecords).toHaveBeenCalledWith('ds', { municipio: 'ARANDA DE DUERO' });
  });

  it('getCentro devuelve el centro por código', async () => {
    const provider = makeProvider([rawCentro('1', 'Uno'), rawCentro('2', 'Dos')]);
    const service = new EducacionService(
      provider,
      new InMemoryCache(),
      'ds',
      'ARANDA DE DUERO',
      centerOfTown,
      600,
    );
    const result = await service.getCentro('2');
    expect(result.data.nombre).toBe('Dos');
  });

  it('getCentro lanza NotFoundError si el código no existe', async () => {
    const provider = makeProvider([rawCentro('1', 'Uno')]);
    const service = new EducacionService(
      provider,
      new InMemoryCache(),
      'ds',
      'ARANDA DE DUERO',
      centerOfTown,
      600,
    );
    await expect(service.getCentro('no-existe')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('sirve caché obsoleta si JCyL falla tras un éxito previo', async () => {
    vi.useFakeTimers();
    try {
      const provider = makeProvider([rawCentro('1', 'Uno')]);
      const cache = new InMemoryCache();
      const service = new EducacionService(
        provider,
        cache,
        'ds',
        'ARANDA DE DUERO',
        centerOfTown,
        1,
      );
      await service.listCentros();
      vi.advanceTimersByTime(1_100);

      const failingProvider = makeProvider([], { fail: true });
      const failingService = new EducacionService(
        failingProvider,
        cache,
        'ds',
        'ARANDA DE DUERO',
        centerOfTown,
        1,
      );
      const result = await failingService.listCentros();
      expect(result.stale).toBe(true);
      expect(result.data).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

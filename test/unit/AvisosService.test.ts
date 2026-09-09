import { describe, expect, it, vi } from 'vitest';
import { AvisosService } from '../../src/services/AvisosService.js';
import { InMemoryCache } from '../../src/cache/InMemoryCache.js';
import type { AvisosProvider } from '../../src/clients/AemetAvisosClient.js';
import { UpstreamError } from '../../src/errors/AppError.js';

const zona = { area: '67', zonaCodigo: '670904', zonaNombre: 'Meseta de Burgos' };

function capXmlVerde(): string {
  return `<?xml version="1.0"?><alert><info>
    <language>es-ES</language>
    <event>Aviso de vientos de nivel verde</event>
    <severity>Minor</severity>
    <headline>h</headline>
    <effective>2026-01-01T00:00:00+01:00</effective>
    <expires>2026-01-02T00:00:00+01:00</expires>
    <parameter><valueName>AEMET-Meteoalerta nivel</valueName><value>verde</value></parameter>
    <area><areaDesc>Meseta de Burgos</areaDesc><geocode><valueName>x</valueName><value>670904</value></geocode></area>
  </info></alert>`;
}

function makeProvider(xmlFiles: string[], opts: { fail?: boolean } = {}): AvisosProvider {
  return {
    fetchAvisos: vi.fn(async () => {
      if (opts.fail) throw new UpstreamError('boom', 'TEST_FAILURE');
      return xmlFiles;
    }),
  };
}

describe('AvisosService', () => {
  it('getSnapshot cachea la respuesta tras la primera llamada', async () => {
    const provider = makeProvider([capXmlVerde()]);
    const service = new AvisosService(provider, new InMemoryCache(), zona, 600);

    const first = await service.getSnapshot();
    const second = await service.getSnapshot();

    expect(provider.fetchAvisos).toHaveBeenCalledTimes(1);
    expect(first.data.zonaCodigo).toBe('670904');
    expect(second.stale).toBe(false);
  });

  it('sirve caché obsoleta si AEMET falla tras un éxito previo', async () => {
    vi.useFakeTimers();
    try {
      const provider = makeProvider([capXmlVerde()]);
      const cache = new InMemoryCache();
      const service = new AvisosService(provider, cache, zona, 1);
      await service.getSnapshot();
      vi.advanceTimersByTime(1_100);

      const failingService = new AvisosService(makeProvider([], { fail: true }), cache, zona, 1);
      const result = await failingService.getSnapshot();
      expect(result.stale).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('propaga UpstreamError si no hay caché previa y AEMET falla', async () => {
    const provider = makeProvider([], { fail: true });
    const service = new AvisosService(provider, new InMemoryCache(), zona, 600);
    await expect(service.getSnapshot()).rejects.toBeInstanceOf(UpstreamError);
  });
});

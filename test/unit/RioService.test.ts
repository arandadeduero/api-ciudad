import { describe, expect, it, vi } from 'vitest';
import { RioService } from '../../src/services/RioService.js';
import { InMemoryCache } from '../../src/cache/InMemoryCache.js';
import type { RioProvider, RioRawReading, RioMetricName } from '../../src/clients/RioClient.js';
import { NotFoundError, UpstreamError, ValidationError } from '../../src/errors/AppError.js';

function reading(hoursAgo: number, value: number): RioRawReading {
  return { timestamp: new Date(Date.now() - hoursAgo * 3600_000).toISOString(), value };
}

function makeProvider(
  series: Record<string, RioRawReading[]>,
  opts: { fail?: boolean } = {},
): RioProvider {
  return {
    fetchSeries: vi.fn(async (_station: string, metric: RioMetricName) => {
      if (opts.fail) throw new UpstreamError('boom', 'TEST_FAILURE');
      return series[metric] ?? [];
    }),
  };
}

describe('RioService', () => {
  it('getSnapshot devuelve el último valor y la tendencia de nivel y caudal', async () => {
    const provider = makeProvider({
      nivel: [reading(4, 1.0), reading(3, 1.0), reading(1, 1.2), reading(0, 1.3)],
      caudal: [reading(4, 20), reading(3, 20), reading(1, 15), reading(0, 14)],
    });
    const service = new RioService(provider, new InMemoryCache(), 'EA013', 600);

    const { data } = await service.getSnapshot();
    expect(data.stationCode).toBe('EA013');
    expect(data.nivel.unit).toBe('m');
    expect(data.nivel.latest.value).toBe(1.3);
    expect(data.nivel.trend).toBe('subiendo'); // 1.0 -> 1.3
    expect(data.caudal.trend).toBe('bajando'); // 20 -> 14
  });

  it('detecta tendencia estable cuando el cambio es pequeño', async () => {
    const provider = makeProvider({
      nivel: [reading(4, 1.0), reading(0, 1.005)],
      caudal: [],
    });
    const service = new RioService(provider, new InMemoryCache(), 'EA013', 600);
    const { data } = await service.getMetric('nivel');
    expect(data.trend).toBe('estable');
  });

  it('getMetric filtra la serie a las últimas N horas mantieniendo el latest global', async () => {
    const provider = makeProvider({
      nivel: [reading(48, 0.9), reading(30, 1.0), reading(2, 1.1), reading(0, 1.2)],
      caudal: [],
    });
    const service = new RioService(provider, new InMemoryCache(), 'EA013', 600);

    const { data } = await service.getMetric('nivel', 24);
    expect(data.latest.value).toBe(1.2);
    expect(
      data.series.every((r) => new Date(r.timestamp).getTime() >= Date.now() - 24 * 3600_000),
    ).toBe(true);
    expect(data.series.length).toBe(2); // las de hace 2h y 0h
  });

  it('rechaza un "hours" inválido', async () => {
    const provider = makeProvider({ nivel: [reading(0, 1)] });
    const service = new RioService(provider, new InMemoryCache(), 'EA013', 600);
    await expect(service.getMetric('nivel', 0)).rejects.toBeInstanceOf(ValidationError);
  });

  it('lanza NotFoundError si la estación no devuelve datos', async () => {
    const provider = makeProvider({ nivel: [] });
    const service = new RioService(provider, new InMemoryCache(), 'EA013', 600);
    await expect(service.getMetric('nivel')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('sirve caché obsoleta si la API falla tras un éxito previo', async () => {
    vi.useFakeTimers();
    try {
      const provider = makeProvider({ nivel: [reading(0, 1.5)] });
      const cache = new InMemoryCache();
      const service = new RioService(provider, cache, 'EA013', 1);
      await service.getMetric('nivel');
      vi.advanceTimersByTime(1_100);

      const failingProvider = makeProvider({}, { fail: true });
      const failingService = new RioService(failingProvider, cache, 'EA013', 1);
      const result = await failingService.getMetric('nivel');
      expect(result.stale).toBe(true);
      expect(result.data.latest.value).toBe(1.5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('propaga UpstreamError si la API falla y no hay nada en caché', async () => {
    const provider = makeProvider({}, { fail: true });
    const service = new RioService(provider, new InMemoryCache(), 'EA013', 600);
    await expect(service.getMetric('nivel')).rejects.toBeInstanceOf(UpstreamError);
  });
});

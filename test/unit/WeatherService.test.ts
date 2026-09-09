import { describe, expect, it, vi } from 'vitest';
import { WeatherService } from '../../src/services/WeatherService.js';
import { InMemoryCache } from '../../src/cache/InMemoryCache.js';
import type {
  WeatherProvider,
  OpenMeteoRequestOptions,
} from '../../src/clients/OpenMeteoClient.js';
import { ValidationError, UpstreamError } from '../../src/errors/AppError.js';
import { todayInMadrid, addDays } from '../../src/utils/date.js';

function fakeRawResponse(today: string) {
  return {
    current: {
      time: `${today}T12:00`,
      temperature_2m: 20,
      apparent_temperature: 19,
      relative_humidity_2m: 50,
      wind_speed_10m: 10,
      wind_direction_10m: 90,
      precipitation: 0,
      cloud_cover: 10,
      pressure_msl: 1015,
      uv_index: 3,
    },
    hourly: {
      time: [`${today}T00:00`, `${today}T01:00`],
      temperature_2m: [15, 14],
      precipitation: [0, 0],
      precipitation_probability: [0, 0],
      wind_speed_10m: [5, 5],
      wind_direction_10m: [90, 90],
      weather_code: [1, 1],
    },
    daily: {
      time: [today],
      sunrise: [`${today}T07:00`],
      sunset: [`${today}T20:00`],
    },
  };
}

function makeProvider(response: unknown, opts: { fail?: boolean } = {}): WeatherProvider {
  return {
    fetchForecast: vi.fn(async (_o: OpenMeteoRequestOptions) => {
      if (opts.fail) throw new UpstreamError('boom', 'TEST_FAILURE');
      return response;
    }),
  };
}

describe('WeatherService', () => {
  const today = todayInMadrid();

  it('devuelve el tiempo actual y cachea la respuesta', async () => {
    const provider = makeProvider(fakeRawResponse(today));
    const cache = new InMemoryCache();
    const service = new WeatherService(provider, cache, { latitude: 0, longitude: 0 }, 600);

    const first = await service.getCurrent();
    expect(first.cached).toBe(false);
    expect(first.data.current.temperature).toBe(20);

    const second = await service.getCurrent();
    expect(second.cached).toBe(true);
    expect(provider.fetchForecast).toHaveBeenCalledTimes(1);
  });

  it('sirve la caché obsoleta (stale) si el proveedor falla tras un éxito previo', async () => {
    vi.useFakeTimers();
    try {
      const provider = makeProvider(fakeRawResponse(today));
      const cache = new InMemoryCache();
      const service = new WeatherService(provider, cache, { latitude: 0, longitude: 0 }, 1);

      await service.getCurrent(); // rellena la cache
      vi.advanceTimersByTime(1_100); // deja expirar el TTL

      const failingProvider = makeProvider(null, { fail: true });
      const serviceWithFailingProvider = new WeatherService(
        failingProvider,
        cache,
        { latitude: 0, longitude: 0 },
        1,
      );

      const result = await serviceWithFailingProvider.getCurrent();
      expect(result.stale).toBe(true);
      expect(result.data.current.temperature).toBe(20);
    } finally {
      vi.useRealTimers();
    }
  });

  it('propaga el error si el proveedor falla y no hay nada en caché', async () => {
    const provider = makeProvider(null, { fail: true });
    const cache = new InMemoryCache();
    const service = new WeatherService(provider, cache, { latitude: 0, longitude: 0 }, 600);

    await expect(service.getCurrent()).rejects.toBeInstanceOf(UpstreamError);
  });

  it('rechaza una fecha con formato inválido en getForDay', async () => {
    const provider = makeProvider(fakeRawResponse(today));
    const service = new WeatherService(
      provider,
      new InMemoryCache(),
      { latitude: 0, longitude: 0 },
      600,
    );
    await expect(service.getForDay('not-a-date')).rejects.toBeInstanceOf(ValidationError);
  });

  it('rechaza una fecha pasada o a más de 7 días vista', async () => {
    const provider = makeProvider(fakeRawResponse(today));
    const service = new WeatherService(
      provider,
      new InMemoryCache(),
      { latitude: 0, longitude: 0 },
      600,
    );
    await expect(service.getForDay(addDays(today, -1))).rejects.toBeInstanceOf(ValidationError);
    await expect(service.getForDay(addDays(today, 8))).rejects.toBeInstanceOf(ValidationError);
  });

  it('acepta el límite exacto de 7 días vista', async () => {
    const provider = makeProvider(fakeRawResponse(today));
    const service = new WeatherService(
      provider,
      new InMemoryCache(),
      { latitude: 0, longitude: 0 },
      600,
    );
    // El fake solo devuelve datos para "today", pero la validación de rango
    // debe pasar sin lanzar ValidationError (puede no haber horas para ese día).
    await expect(service.getForDay(addDays(today, 7))).resolves.toBeDefined();
  });
});

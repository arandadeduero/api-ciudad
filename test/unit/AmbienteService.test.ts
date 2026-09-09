import { describe, expect, it, vi } from 'vitest';
import { AmbienteService } from '../../src/services/AmbienteService.js';
import { InMemoryCache } from '../../src/cache/InMemoryCache.js';
import type { JcylProvider } from '../../src/clients/JcylClient.js';
import { NotFoundError, UpstreamError, ValidationError } from '../../src/errors/AppError.js';
import { todayInMadrid, addDays } from '../../src/utils/date.js';

const station = {
  id: 82,
  name: 'Aranda de Duero 2',
  province: 'Burgos',
  location: { latitude: 41.6656, longitude: -3.6889 },
};

function hourlyRecord(hora: string, contaminantes: string, valor: number, dia: string) {
  return {
    dia,
    hora,
    codprovincia: '09',
    nombreprovincia: 'Burgos',
    idestacion: 82,
    nombreestacion: 'Aranda de Duero 2',
    contaminantes,
    valor,
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

describe('AmbienteService', () => {
  const today = todayInMadrid();

  it('getToday cachea la respuesta tras la primera llamada', async () => {
    const provider = makeProvider([hourlyRecord('00:00', 'NO (ug/m3)', 1, today)]);
    const service = new AmbienteService(
      provider,
      new InMemoryCache(),
      station,
      'dataset-hoy',
      'dataset-historico',
      600,
    );

    const first = await service.getToday();
    expect(first.cached).toBe(false);
    const second = await service.getToday();
    expect(second.cached).toBe(true);
    expect(provider.fetchAllRecords).toHaveBeenCalledTimes(1);
  });

  it('getForDate con la fecha de hoy delega en getToday', async () => {
    const provider = makeProvider([hourlyRecord('00:00', 'NO (ug/m3)', 1, today)]);
    const service = new AmbienteService(
      provider,
      new InMemoryCache(),
      station,
      'dataset-hoy',
      'dataset-historico',
      600,
    );
    const result = await service.getForDate(today);
    expect(result.data.granularity).toBe('hourly');
  });

  it('getForDate con una fecha pasada consulta el histórico diario', async () => {
    const pastDate = '2025-12-21';
    const provider: JcylProvider = {
      fetchAllRecords: vi.fn(async () => [
        {
          fecha: pastDate,
          co_mg_m3: null,
          no_ug_m3: 2,
          no2_ug_m3: 5,
          o3_ug_m3: 68,
          pm10_ug_m3: 2,
          pm25_ug_m3: 1,
          so2_ug_m3: 2,
          provincia: 'Burgos',
          estacion: 'Aranda de Duero 2',
          latitud: 41.6656,
          longitud: -3.6889,
        },
      ]),
    };
    const service = new AmbienteService(
      provider,
      new InMemoryCache(),
      station,
      'dataset-hoy',
      'dataset-historico',
      600,
    );
    const result = await service.getForDate(pastDate);
    expect(result.data.granularity).toBe('daily');
    expect(result.data.date).toBe(pastDate);
  });

  it('getForDate devuelve 404 si el histórico no tiene esa fecha', async () => {
    const provider = makeProvider([]);
    const service = new AmbienteService(
      provider,
      new InMemoryCache(),
      station,
      'dataset-hoy',
      'dataset-historico',
      600,
    );
    await expect(service.getForDate('2020-01-01')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('getForDate rechaza fechas futuras', async () => {
    const provider = makeProvider([]);
    const service = new AmbienteService(
      provider,
      new InMemoryCache(),
      station,
      'dataset-hoy',
      'dataset-historico',
      600,
    );
    await expect(service.getForDate(addDays(today, 1))).rejects.toBeInstanceOf(ValidationError);
  });

  it('getForDate rechaza formato inválido', async () => {
    const provider = makeProvider([]);
    const service = new AmbienteService(
      provider,
      new InMemoryCache(),
      station,
      'dataset-hoy',
      'dataset-historico',
      600,
    );
    await expect(service.getForDate('no-es-fecha')).rejects.toBeInstanceOf(ValidationError);
  });

  it('sirve caché obsoleta si JCyL falla tras un éxito previo', async () => {
    vi.useFakeTimers();
    try {
      const provider = makeProvider([hourlyRecord('00:00', 'NO (ug/m3)', 1, today)]);
      const cache = new InMemoryCache();
      const service = new AmbienteService(
        provider,
        cache,
        station,
        'dataset-hoy',
        'dataset-historico',
        1,
      );
      await service.getToday();
      vi.advanceTimersByTime(1_100);

      const failingProvider = makeProvider([], { fail: true });
      const failingService = new AmbienteService(
        failingProvider,
        cache,
        station,
        'dataset-hoy',
        'dataset-historico',
        1,
      );
      const result = await failingService.getToday();
      expect(result.stale).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

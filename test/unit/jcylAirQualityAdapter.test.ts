import { describe, expect, it } from 'vitest';
import { toHourlySnapshot, toDailySnapshot } from '../../src/adapters/jcylAirQualityAdapter.js';
import { UpstreamError } from '../../src/errors/AppError.js';

const station = {
  id: 82,
  name: 'Aranda de Duero 2',
  province: 'Burgos',
  location: { latitude: 41.6656, longitude: -3.6889 },
};

describe('toHourlySnapshot', () => {
  const rawHourly = [
    {
      dia: '2026-09-08',
      hora: '00:00',
      codprovincia: '09',
      nombreprovincia: 'Burgos',
      idestacion: 82,
      nombreestacion: 'Aranda de Duero 2',
      contaminantes: 'NO (ug/m3)',
      valor: 1.0,
    },
    {
      dia: '2026-09-08',
      hora: '00:00',
      codprovincia: '09',
      nombreprovincia: 'Burgos',
      idestacion: 82,
      nombreestacion: 'Aranda de Duero 2',
      contaminantes: 'O3 (ug/m3)',
      valor: 36.0,
    },
    {
      dia: '2026-09-08',
      hora: '05:00',
      codprovincia: '09',
      nombreprovincia: 'Burgos',
      idestacion: 82,
      nombreestacion: 'Aranda de Duero 2',
      contaminantes: 'PM10 (ug/m3)',
      valor: 41.0,
    },
  ];

  it('pivota el formato largo a horas agrupadas con sus contaminantes', () => {
    const snapshot = toHourlySnapshot(rawHourly, station, '2026-09-08', 'test');
    expect(snapshot.granularity).toBe('hourly');
    expect(snapshot.hourly).toHaveLength(2); // 00:00 y 05:00
    const midnight = snapshot.hourly.find((h) => h.hour === '00:00')!;
    expect(midnight.pollutants).toHaveLength(2);
    expect(midnight.pollutants.find((p) => p.code === 'NO')).toMatchObject({
      unit: 'ug/m3',
      value: 1.0,
    });
    expect(midnight.pollutants.find((p) => p.code === 'O3')?.label).toBe('Ozono');
  });

  it('ordena las horas', () => {
    const snapshot = toHourlySnapshot(rawHourly, station, '2026-09-08', 'test');
    expect(snapshot.hourly.map((h) => h.hour)).toEqual(['00:00', '05:00']);
  });

  it('lanza UpstreamError si el formato no coincide', () => {
    expect(() => toHourlySnapshot([{ foo: 'bar' }], station, '2026-09-08', 'test')).toThrow(
      UpstreamError,
    );
  });
});

describe('toDailySnapshot', () => {
  const rawDaily = {
    fecha: '2025-12-21',
    co_mg_m3: null,
    no_ug_m3: 2,
    no2_ug_m3: 5,
    o3_ug_m3: 68,
    pm10_ug_m3: 2,
    pm25_ug_m3: 1,
    so2_ug_m3: 2,
    provincia: 'Burgos',
    estacion: 'Aranda de Duero 2',
    latitud: 41.66555555555556,
    longitud: -3.688888888888889,
  };

  it('mapea el formato ancho diario a la lista de contaminantes, omitiendo nulos', () => {
    const snapshot = toDailySnapshot(rawDaily, 82, 'test');
    expect(snapshot.granularity).toBe('daily');
    expect(snapshot.date).toBe('2025-12-21');
    expect(snapshot.daily).toHaveLength(6); // todos menos co_mg_m3 (null)
    expect(snapshot.daily?.find((p) => p.code === 'CO')).toBeUndefined();
    expect(snapshot.daily?.find((p) => p.code === 'O3')).toMatchObject({
      value: 68,
      unit: 'ug/m3',
    });
  });

  it('lanza UpstreamError si el formato no coincide', () => {
    expect(() => toDailySnapshot({ foo: 'bar' }, 82, 'test')).toThrow(UpstreamError);
  });
});

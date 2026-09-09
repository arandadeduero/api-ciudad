import { describe, expect, it } from 'vitest';
import { toWeatherSnapshot } from '../../src/adapters/openMeteoAdapter.js';
import { UpstreamError } from '../../src/errors/AppError.js';

const validResponse = {
  current: {
    time: '2026-09-09T09:30',
    temperature_2m: 14.4,
    apparent_temperature: 11.5,
    relative_humidity_2m: 77,
    wind_speed_10m: 21.1,
    wind_direction_10m: 8,
    precipitation: 0,
    cloud_cover: 83,
    pressure_msl: 1018.5,
    uv_index: 0.75,
  },
  hourly: {
    time: ['2026-09-09T00:00', '2026-09-09T01:00'],
    temperature_2m: [12.1, 11.9],
    precipitation: [0, 0],
    precipitation_probability: [5, 5],
    wind_speed_10m: [10, 11],
    wind_direction_10m: [180, 182],
    weather_code: [1, 1],
  },
  daily: {
    time: ['2026-09-09'],
    sunrise: ['2026-09-09T07:48'],
    sunset: ['2026-09-09T20:35'],
  },
};

describe('toWeatherSnapshot', () => {
  it('mapea una respuesta válida de Open-Meteo al modelo de dominio', () => {
    const snapshot = toWeatherSnapshot(validResponse);
    expect(snapshot.current.temperature).toBe(14.4);
    expect(snapshot.current.humidity).toBe(77);
    expect(snapshot.hourly).toHaveLength(2);
    expect(snapshot.hourly[0]).toMatchObject({ time: '2026-09-09T00:00', temperature: 12.1 });
    expect(snapshot.daily[0]).toMatchObject({ date: '2026-09-09', sunrise: '2026-09-09T07:48' });
  });

  it('lanza UpstreamError si falta un campo esperado', () => {
    const broken = {
      ...validResponse,
      current: { ...validResponse.current, temperature_2m: undefined },
    };
    expect(() => toWeatherSnapshot(broken)).toThrow(UpstreamError);
  });

  it('lanza UpstreamError ante una respuesta completamente distinta', () => {
    expect(() => toWeatherSnapshot({ unexpected: true })).toThrow(UpstreamError);
  });
});

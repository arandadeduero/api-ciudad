import { z } from 'zod';
import { UpstreamError } from '../errors/AppError.js';
import type { WeatherSnapshot } from '../domain/weather.js';

/**
 * Schema de validación de la respuesta de Open-Meteo. Nunca confiamos en
 * la forma del JSON de un proveedor externo (§15 del prompt maestro) —
 * si Open-Meteo cambia su contrato, este adapter falla de forma
 * controlada (UpstreamError) en vez de propagar un TypeError críptico.
 */
const openMeteoResponseSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    wind_speed_10m: z.number(),
    wind_direction_10m: z.number(),
    precipitation: z.number(),
    cloud_cover: z.number(),
    pressure_msl: z.number(),
    uv_index: z.number(),
  }),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number()),
    precipitation: z.array(z.number()),
    precipitation_probability: z.array(z.number()),
    wind_speed_10m: z.array(z.number()),
    wind_direction_10m: z.array(z.number()),
    weather_code: z.array(z.number()),
  }),
  daily: z.object({
    time: z.array(z.string()),
    sunrise: z.array(z.string()),
    sunset: z.array(z.string()),
  }),
});

export function toWeatherSnapshot(raw: unknown): WeatherSnapshot {
  const parsed = openMeteoResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new UpstreamError(
      `Respuesta de Open-Meteo con formato inesperado: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
      'OPEN_METEO_UNEXPECTED_SHAPE',
    );
  }

  const { current, hourly, daily } = parsed.data;

  return {
    current: {
      time: current.time,
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      precipitation: current.precipitation,
      cloudCover: current.cloud_cover,
      pressure: current.pressure_msl,
      uvIndex: current.uv_index,
    },
    hourly: hourly.time.map((time, i) => ({
      time,
      temperature: hourly.temperature_2m[i]!,
      precipitation: hourly.precipitation[i]!,
      precipitationProbability: hourly.precipitation_probability[i]!,
      windSpeed: hourly.wind_speed_10m[i]!,
      windDirection: hourly.wind_direction_10m[i]!,
      weatherCode: hourly.weather_code[i]!,
    })),
    daily: daily.time.map((date, i) => ({
      date,
      sunrise: daily.sunrise[i]!,
      sunset: daily.sunset[i]!,
    })),
  };
}

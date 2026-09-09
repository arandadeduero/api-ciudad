import type { WeatherProvider } from '../clients/OpenMeteoClient.js';
import { toWeatherSnapshot } from '../adapters/openMeteoAdapter.js';
import type { WeatherSnapshot, HourlyForecastPoint, DailySummary } from '../domain/weather.js';
import type { CacheService } from '../cache/CacheService.js';
import { ValidationError, UpstreamError } from '../errors/AppError.js';
import { isValidIsoDate, todayInMadrid, addDays } from '../utils/date.js';

const CACHE_KEY = 'weather:snapshot';
const MAX_FORECAST_DAYS = 7;
/** Open-Meteo cuenta "hoy" como uno de los forecast_days. */
const OPEN_METEO_FORECAST_DAYS = MAX_FORECAST_DAYS + 1;

export interface WeatherResult<T> {
  data: T;
  cached: boolean;
  stale: boolean;
}

export class WeatherService {
  constructor(
    private readonly client: WeatherProvider,
    private readonly cache: CacheService,
    private readonly coords: { latitude: number; longitude: number },
    private readonly ttlSeconds: number,
  ) {}

  private async getSnapshot(): Promise<WeatherResult<WeatherSnapshot>> {
    const cached = await this.cache.get<WeatherSnapshot>(CACHE_KEY);
    if (cached) {
      return { data: cached, cached: true, stale: false };
    }

    try {
      const raw = await this.client.fetchForecast({
        latitude: this.coords.latitude,
        longitude: this.coords.longitude,
        forecastDays: OPEN_METEO_FORECAST_DAYS,
      });
      const snapshot = toWeatherSnapshot(raw);
      await this.cache.set(CACHE_KEY, snapshot, this.ttlSeconds);
      return { data: snapshot, cached: false, stale: false };
    } catch (err) {
      // Open-Meteo caído o respondiendo mal: servimos el último dato bueno
      // conocido (aunque haya expirado su TTL) en vez de tumbar la request.
      const stale = await this.cache.getStale<WeatherSnapshot>(CACHE_KEY);
      if (stale) {
        return { data: stale, cached: true, stale: true };
      }
      throw err instanceof UpstreamError
        ? err
        : new UpstreamError(
            'No se pudo obtener la previsión meteorológica.',
            'WEATHER_UNAVAILABLE',
          );
    }
  }

  async getCurrent(): Promise<
    WeatherResult<{ current: WeatherSnapshot['current']; today: HourlyForecastPoint[] }>
  > {
    const { data, cached, stale } = await this.getSnapshot();
    const today = todayInMadrid();
    return {
      data: {
        current: data.current,
        today: data.hourly.filter((h) => h.time.startsWith(today)),
      },
      cached,
      stale,
    };
  }

  async getForDay(
    dateStr: string,
  ): Promise<
    WeatherResult<{ date: string; hourly: HourlyForecastPoint[]; daily: DailySummary | null }>
  > {
    if (!isValidIsoDate(dateStr)) {
      throw new ValidationError(
        `Fecha inválida: "${dateStr}". Formato esperado: YYYY-MM-DD.`,
        'INVALID_DATE',
      );
    }

    const today = todayInMadrid();
    const maxDate = addDays(today, MAX_FORECAST_DAYS);
    if (dateStr < today || dateStr > maxDate) {
      throw new ValidationError(
        `Solo se admiten fechas entre hoy (${today}) y ${maxDate} (máximo ${MAX_FORECAST_DAYS} días vista).`,
        'DATE_OUT_OF_RANGE',
      );
    }

    const { data, cached, stale } = await this.getSnapshot();
    return {
      data: {
        date: dateStr,
        hourly: data.hourly.filter((h) => h.time.startsWith(dateStr)),
        daily: data.daily.find((d) => d.date === dateStr) ?? null,
      },
      cached,
      stale,
    };
  }
}

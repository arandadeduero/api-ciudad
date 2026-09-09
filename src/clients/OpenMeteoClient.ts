import { UpstreamError } from '../errors/AppError.js';
import { withExternalRequestMetrics } from '../telemetry/metrics.js';

const METRIC_SOURCE = 'open-meteo';

export interface OpenMeteoRequestOptions {
  latitude: number;
  longitude: number;
  forecastDays: number;
}

/**
 * Contrato mínimo que necesita WeatherService. El servicio depende de esta
 * interfaz, no de la clase concreta — permite sustituir el proveedor (o
 * usar un doble de test) sin tocar la capa de servicio.
 */
export interface WeatherProvider {
  fetchForecast(options: OpenMeteoRequestOptions): Promise<unknown>;
}

const CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'precipitation',
  'cloud_cover',
  'pressure_msl',
  'uv_index',
].join(',');

const HOURLY_FIELDS = [
  'temperature_2m',
  'precipitation',
  'precipitation_probability',
  'wind_speed_10m',
  'wind_direction_10m',
  'weather_code',
].join(',');

const DAILY_FIELDS = ['sunrise', 'sunset'].join(',');

/**
 * Cliente HTTP puro para Open-Meteo. Solo sabe hablar con este proveedor
 * concreto — la traducción al modelo de dominio la hace el adapter
 * (src/adapters/openMeteoAdapter.ts), nunca este cliente.
 */
export class OpenMeteoClient implements WeatherProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 5000,
  ) {}

  async fetchForecast(options: OpenMeteoRequestOptions): Promise<unknown> {
    return withExternalRequestMetrics(METRIC_SOURCE, () => this.doFetch(options));
  }

  private async doFetch(options: OpenMeteoRequestOptions): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/forecast`);
    url.searchParams.set('latitude', String(options.latitude));
    url.searchParams.set('longitude', String(options.longitude));
    url.searchParams.set('current', CURRENT_FIELDS);
    url.searchParams.set('hourly', HOURLY_FIELDS);
    url.searchParams.set('daily', DAILY_FIELDS);
    url.searchParams.set('timezone', 'Europe/Madrid');
    url.searchParams.set('forecast_days', String(options.forecastDays));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new UpstreamError(`Open-Meteo respondió ${res.status}`, 'OPEN_METEO_ERROR');
      }
      return await res.json();
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new UpstreamError('Timeout al consultar Open-Meteo', 'OPEN_METEO_TIMEOUT');
      }
      throw new UpstreamError(
        `Error de red al consultar Open-Meteo: ${(err as Error).message}`,
        'OPEN_METEO_NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

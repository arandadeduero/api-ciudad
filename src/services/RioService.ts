import type { RioProvider, RioMetricName, RioRawReading } from '../clients/RioClient.js';
import type { RiverMetric, RiverMetricSummary, RiverSnapshot, RiverTrend } from '../domain/rio.js';
import type { CacheService } from '../cache/CacheService.js';
import { NotFoundError, UpstreamError, ValidationError } from '../errors/AppError.js';

export interface RioResult<T> {
  data: T;
  stale: boolean;
}

const SOURCE =
  'API de terceros sobre datos SAIH — Confederación Hidrográfica del Duero (no es la API oficial de la CHD)';

const UNITS: Record<RioMetricName, string> = { nivel: 'm', caudal: 'm³/s' };

/** Ventana de comparación para calcular la tendencia. */
const TREND_WINDOW_HOURS = 3;
/** Por debajo de este cambio relativo, se considera "estable" en vez de subiendo/bajando. */
const TREND_THRESHOLD_RATIO = 0.02;

function computeTrend(series: RioRawReading[]): RiverTrend {
  if (series.length < 2) return 'estable';
  const latest = series[series.length - 1]!;
  const latestTime = new Date(latest.timestamp).getTime();
  const targetTime = latestTime - TREND_WINDOW_HOURS * 3600_000;

  // Lectura más cercana a "hace TREND_WINDOW_HOURS horas".
  let reference = series[0]!;
  for (const reading of series) {
    if (new Date(reading.timestamp).getTime() <= targetTime) {
      reference = reading;
    } else {
      break;
    }
  }

  if (reference.value === 0)
    return latest.value === 0 ? 'estable' : latest.value > 0 ? 'subiendo' : 'bajando';

  const change = (latest.value - reference.value) / Math.abs(reference.value);
  if (Math.abs(change) < TREND_THRESHOLD_RATIO) return 'estable';
  return change > 0 ? 'subiendo' : 'bajando';
}

export class RioService {
  constructor(
    private readonly client: RioProvider,
    private readonly cache: CacheService,
    private readonly stationCode: string,
    private readonly ttlSeconds: number,
  ) {}

  private async getRawSeries(
    metric: RioMetricName,
  ): Promise<{ series: RioRawReading[]; stale: boolean }> {
    const cacheKey = `rio:${this.stationCode}:${metric}`;
    const cached = await this.cache.get<RioRawReading[]>(cacheKey);
    if (cached) return { series: cached, stale: false };

    try {
      const series = await this.client.fetchSeries(this.stationCode, metric);
      if (series.length === 0) {
        throw new NotFoundError(
          `La estación "${this.stationCode}" no tiene datos de "${metric}" (código de estación inexistente o sin lecturas).`,
        );
      }
      await this.cache.set(cacheKey, series, this.ttlSeconds);
      return { series, stale: false };
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      const stale = await this.cache.getStale<RioRawReading[]>(cacheKey);
      if (stale) return { series: stale, stale: true };
      throw err instanceof UpstreamError
        ? err
        : new UpstreamError('No se pudo obtener el dato del río.', 'RIO_UNAVAILABLE');
    }
  }

  private toSummary(series: RioRawReading[], metric: RioMetricName): RiverMetricSummary {
    return {
      unit: UNITS[metric],
      latest: series[series.length - 1]!,
      trend: computeTrend(series),
    };
  }

  private toMetric(series: RioRawReading[], metric: RioMetricName, hours: number): RiverMetric {
    const cutoff = Date.now() - hours * 3600_000;
    const windowed = series.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
    const effective = windowed.length > 0 ? windowed : series.slice(-1);

    return { ...this.toSummary(series, metric), series: effective };
  }

  async getMetric(metric: RioMetricName, hours = 24): Promise<RioResult<RiverMetric>> {
    if (!Number.isFinite(hours) || hours < 1) {
      throw new ValidationError('El parámetro "hours" debe ser un número mayor o igual a 1.');
    }
    const { series, stale } = await this.getRawSeries(metric);
    return { data: this.toMetric(series, metric, hours), stale };
  }

  async getSnapshot(): Promise<RioResult<RiverSnapshot>> {
    const [nivelResult, caudalResult] = await Promise.all([
      this.getRawSeries('nivel'),
      this.getRawSeries('caudal'),
    ]);

    return {
      data: {
        stationCode: this.stationCode,
        nivel: this.toSummary(nivelResult.series, 'nivel'),
        caudal: this.toSummary(caudalResult.series, 'caudal'),
        source: SOURCE,
      },
      stale: nivelResult.stale || caudalResult.stale,
    };
  }
}

import type { JcylProvider } from '../clients/JcylClient.js';
import { toHourlySnapshot, toDailySnapshot } from '../adapters/jcylAirQualityAdapter.js';
import type { AirQualitySnapshot } from '../domain/ambiente.js';
import type { CacheService } from '../cache/CacheService.js';
import { NotFoundError, ValidationError, UpstreamError } from '../errors/AppError.js';
import { isValidIsoDate, todayInMadrid } from '../utils/date.js';

export interface AmbienteResult {
  data: AirQualitySnapshot;
  cached: boolean;
  stale: boolean;
}

export interface StationConfig {
  id: number;
  name: string;
  province: string;
  location: { latitude: number; longitude: number };
}

const SOURCE_TODAY = 'JCyL — Datos Abiertos (dataset: calidad-del-aire-del-dia-en-curso)';
const SOURCE_HISTORICAL =
  'JCyL — Datos Abiertos (dataset: calidad-del-aire-datos-historicos-diarios)';

export class AmbienteService {
  constructor(
    private readonly client: JcylProvider,
    private readonly cache: CacheService,
    private readonly station: StationConfig,
    private readonly datasetToday: string,
    private readonly datasetHistorical: string,
    private readonly ttlSeconds: number,
  ) {}

  async getToday(): Promise<AmbienteResult> {
    const today = todayInMadrid();
    const cacheKey = `ambiente:today:${today}`;

    const cached = await this.cache.get<AirQualitySnapshot>(cacheKey);
    if (cached) return { data: cached, cached: true, stale: false };

    try {
      const raw = await this.client.fetchAllRecords(this.datasetToday, {
        nombreprovincia: this.station.province,
        nombreestacion: this.station.name,
      });
      const snapshot = toHourlySnapshot(raw, this.station, today, SOURCE_TODAY);
      await this.cache.set(cacheKey, snapshot, this.ttlSeconds);
      return { data: snapshot, cached: false, stale: false };
    } catch (err) {
      const stale = await this.cache.getStale<AirQualitySnapshot>(cacheKey);
      if (stale) return { data: stale, cached: true, stale: true };
      throw err instanceof UpstreamError
        ? err
        : new UpstreamError('No se pudo obtener la calidad del aire.', 'AMBIENTE_UNAVAILABLE');
    }
  }

  async getForDate(dateStr: string): Promise<AmbienteResult> {
    if (!isValidIsoDate(dateStr)) {
      throw new ValidationError(
        `Fecha inválida: "${dateStr}". Formato esperado: YYYY-MM-DD.`,
        'INVALID_DATE',
      );
    }

    const today = todayInMadrid();
    if (dateStr > today) {
      throw new ValidationError(
        `No hay datos de calidad del aire para fechas futuras (${dateStr} es posterior a hoy, ${today}).`,
        'DATE_IN_FUTURE',
      );
    }
    if (dateStr === today) {
      return this.getToday();
    }

    // Fecha pasada: el dataset "día en curso" no la cubre — se consulta el
    // histórico diario validado, que tiene menor resolución (un valor por
    // contaminante y día) y un retraso de publicación no documentado por
    // JCyL (ver docs/architecture-proposal.md §2.2).
    const cacheKey = `ambiente:historical:${dateStr}`;
    const cached = await this.cache.get<AirQualitySnapshot>(cacheKey);
    if (cached) return { data: cached, cached: true, stale: false };

    try {
      const raw = await this.client.fetchAllRecords(this.datasetHistorical, {
        estacion: this.station.name,
        fecha: dateStr,
      });
      if (raw.length === 0) {
        throw new NotFoundError(
          `No hay datos de calidad del aire históricos para ${dateStr} en la estación ${this.station.name}. ` +
            'Puede que aún no estén validados/publicados por JCyL (hay un retraso de publicación de varios meses).',
          'HISTORICAL_DATA_NOT_AVAILABLE',
        );
      }
      const snapshot = toDailySnapshot(raw[0], this.station.id, SOURCE_HISTORICAL);
      // TTL largo: los datos históricos validados no cambian retroactivamente.
      await this.cache.set(cacheKey, snapshot, 60 * 60 * 24);
      return { data: snapshot, cached: false, stale: false };
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      const stale = await this.cache.getStale<AirQualitySnapshot>(cacheKey);
      if (stale) return { data: stale, cached: true, stale: true };
      throw err instanceof UpstreamError
        ? err
        : new UpstreamError(
            'No se pudo obtener la calidad del aire histórica.',
            'AMBIENTE_HISTORICAL_UNAVAILABLE',
          );
    }
  }
}

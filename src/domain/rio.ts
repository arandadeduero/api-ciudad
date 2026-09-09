export type RiverTrend = 'subiendo' | 'bajando' | 'estable';

export interface RiverReading {
  timestamp: string; // ISO 8601
  value: number;
}

export interface RiverMetricSummary {
  /** Unidad probable según convención SAIH estándar; la API de origen no la especifica (ver DATA-SOURCES.md). */
  unit: string;
  latest: RiverReading;
  trend: RiverTrend;
}

export interface RiverMetric extends RiverMetricSummary {
  series: RiverReading[];
}

export interface RiverSnapshot {
  stationCode: string;
  nivel: RiverMetricSummary;
  caudal: RiverMetricSummary;
  source: string;
}

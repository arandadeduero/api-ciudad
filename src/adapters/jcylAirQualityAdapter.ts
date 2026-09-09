import { z } from 'zod';
import { UpstreamError } from '../errors/AppError.js';
import type { AirQualitySnapshot, HourlyAirQuality, PollutantReading } from '../domain/ambiente.js';

const POLLUTANT_LABELS: Record<string, string> = {
  NO: 'Monóxido de nitrógeno',
  NO2: 'Dióxido de nitrógeno',
  O3: 'Ozono',
  PM10: 'Partículas PM10',
  PM25: 'Partículas PM2.5',
  SO2: 'Dióxido de azufre',
  CO: 'Monóxido de carbono',
};

function labelFor(code: string): string {
  return POLLUTANT_LABELS[code] ?? code;
}

// ─── Dataset "calidad-del-aire-del-dia-en-curso" (formato largo, horario) ───

const hourlyRecordSchema = z.object({
  dia: z.string(),
  hora: z.string(),
  codprovincia: z.string(),
  nombreprovincia: z.string(),
  idestacion: z.number(),
  nombreestacion: z.string(),
  contaminantes: z.string(),
  valor: z.number(),
});

function parseContaminante(raw: string): { code: string; unit: string } {
  // Formato observado: "PM10 (ug/m3)"
  const match = /^(\S+)\s*\(([^)]+)\)$/.exec(raw);
  if (!match) return { code: raw, unit: '' };
  return { code: match[1]!, unit: match[2]! };
}

export function toHourlySnapshot(
  rawRecords: unknown[],
  station: {
    id: number;
    name: string;
    province: string;
    location: { latitude: number; longitude: number };
  },
  date: string,
  source: string,
): AirQualitySnapshot {
  const parsed = z.array(hourlyRecordSchema).safeParse(rawRecords);
  if (!parsed.success) {
    throw new UpstreamError(
      `Respuesta de JCyL (día en curso) con formato inesperado: ${parsed.error.issues[0]?.path.join('.')}`,
      'JCYL_UNEXPECTED_SHAPE',
    );
  }

  const byHour = new Map<string, PollutantReading[]>();
  for (const rec of parsed.data) {
    const { code, unit } = parseContaminante(rec.contaminantes);
    const list = byHour.get(rec.hora) ?? [];
    list.push({ code, label: labelFor(code), unit, value: rec.valor });
    byHour.set(rec.hora, list);
  }

  const hourly: HourlyAirQuality[] = [...byHour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, pollutants]) => ({ hour, pollutants }));

  return {
    station,
    date,
    granularity: 'hourly',
    hourly,
    daily: null,
    source,
  };
}

// ─── Dataset "calidad-del-aire-datos-historicos-diarios" (formato ancho, diario) ───

const dailyRecordSchema = z.object({
  fecha: z.string(),
  co_mg_m3: z.number().nullable(),
  no_ug_m3: z.number().nullable(),
  no2_ug_m3: z.number().nullable(),
  o3_ug_m3: z.number().nullable(),
  pm10_ug_m3: z.number().nullable(),
  pm25_ug_m3: z.number().nullable(),
  so2_ug_m3: z.number().nullable(),
  provincia: z.string(),
  estacion: z.string(),
  latitud: z.number(),
  longitud: z.number(),
});

const DAILY_FIELD_MAP: {
  field: keyof z.infer<typeof dailyRecordSchema>;
  code: string;
  unit: string;
}[] = [
  { field: 'co_mg_m3', code: 'CO', unit: 'mg/m3' },
  { field: 'no_ug_m3', code: 'NO', unit: 'ug/m3' },
  { field: 'no2_ug_m3', code: 'NO2', unit: 'ug/m3' },
  { field: 'o3_ug_m3', code: 'O3', unit: 'ug/m3' },
  { field: 'pm10_ug_m3', code: 'PM10', unit: 'ug/m3' },
  { field: 'pm25_ug_m3', code: 'PM25', unit: 'ug/m3' },
  { field: 'so2_ug_m3', code: 'SO2', unit: 'ug/m3' },
];

export function toDailySnapshot(
  rawRecord: unknown,
  stationId: number,
  source: string,
): AirQualitySnapshot {
  const parsed = dailyRecordSchema.safeParse(rawRecord);
  if (!parsed.success) {
    throw new UpstreamError(
      `Respuesta de JCyL (histórico diario) con formato inesperado: ${parsed.error.issues[0]?.path.join('.')}`,
      'JCYL_UNEXPECTED_SHAPE',
    );
  }

  const rec = parsed.data;
  const daily: PollutantReading[] = [];
  for (const { field, code, unit } of DAILY_FIELD_MAP) {
    const value = rec[field] as number | null;
    if (value !== null) {
      daily.push({ code, label: labelFor(code), unit, value });
    }
  }

  return {
    station: {
      id: stationId,
      name: rec.estacion,
      province: rec.provincia,
      location: { latitude: rec.latitud, longitude: rec.longitud },
    },
    date: rec.fecha,
    granularity: 'daily',
    hourly: [],
    daily,
    source,
  };
}

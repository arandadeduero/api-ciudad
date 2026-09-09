import { parseCsv } from '../utils/csv.js';
import type { GtfsCalendarRecord, GtfsExceptionType } from '../utils/gtfsCalendar.js';
import { UpstreamError } from '../errors/AppError.js';

export interface GtfsRoute {
  id: string;
  shortName: string;
  longName: string;
  color: string | null;
}

export interface GtfsStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  wheelchairBoarding: boolean | null;
}

export interface GtfsTrip {
  id: string;
  routeId: string;
  serviceId: string;
  headsign: string;
}

export interface GtfsStopTime {
  tripId: string;
  stopId: string;
  sequence: number;
  /** Segundos desde medianoche del día de servicio. Puede ser >=86400 si el viaje cruza medianoche (spec GTFS). */
  departureSeconds: number;
}

export interface GtfsData {
  releaseTag: string;
  agencyName: string;
  routes: Map<string, GtfsRoute>;
  stops: Map<string, GtfsStop>;
  trips: Map<string, GtfsTrip>;
  stopTimesByStop: Map<string, GtfsStopTime[]>;
  stopTimesByTrip: Map<string, GtfsStopTime[]>;
  calendar: Map<string, GtfsCalendarRecord>;
  calendarExceptions: Map<string, Map<string, GtfsExceptionType>>;
}

function parseTimeToSeconds(hhmmss: string): number | null {
  const match = /^(\d{1,3}):(\d{2}):(\d{2})$/.exec(hhmmss.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function toBool01(value: string): boolean {
  return value === '1';
}

export function toGtfsData(files: Record<string, string>, releaseTag: string): GtfsData {
  const required = [
    'agency.txt',
    'stops.txt',
    'routes.txt',
    'trips.txt',
    'stop_times.txt',
    'calendar.txt',
  ];
  for (const name of required) {
    if (!files[name]) {
      throw new UpstreamError(`Falta el fichero ${name} en el feed GTFS`, 'GTFS_MISSING_FILE');
    }
  }

  const agencyRows = parseCsv(files['agency.txt']!);
  const agencyName = agencyRows[0]?.agency_name ?? 'Desconocida';

  const routes = new Map<string, GtfsRoute>();
  for (const row of parseCsv(files['routes.txt']!)) {
    routes.set(row.route_id!, {
      id: row.route_id!,
      shortName: row.route_short_name ?? '',
      longName: row.route_long_name ?? '',
      color: row.route_color || null,
    });
  }

  const stops = new Map<string, GtfsStop>();
  for (const row of parseCsv(files['stops.txt']!)) {
    const lat = Number(row.stop_lat);
    const lon = Number(row.stop_lon);
    if (!row.stop_id || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    stops.set(row.stop_id, {
      id: row.stop_id,
      name: row.stop_name ?? '',
      latitude: lat,
      longitude: lon,
      wheelchairBoarding:
        row.wheelchair_boarding === '' || row.wheelchair_boarding === undefined
          ? null
          : row.wheelchair_boarding === '1',
    });
  }

  const trips = new Map<string, GtfsTrip>();
  for (const row of parseCsv(files['trips.txt']!)) {
    if (!row.trip_id) continue;
    trips.set(row.trip_id, {
      id: row.trip_id,
      routeId: row.route_id ?? '',
      serviceId: row.service_id ?? '',
      headsign: row.trip_headsign ?? '',
    });
  }

  const stopTimesByStop = new Map<string, GtfsStopTime[]>();
  const stopTimesByTrip = new Map<string, GtfsStopTime[]>();
  for (const row of parseCsv(files['stop_times.txt']!)) {
    const seconds = parseTimeToSeconds(row.departure_time ?? '');
    if (!row.trip_id || !row.stop_id || seconds === null) continue;
    const entry: GtfsStopTime = {
      tripId: row.trip_id,
      stopId: row.stop_id,
      sequence: Number(row.stop_sequence) || 0,
      departureSeconds: seconds,
    };
    (
      stopTimesByStop.get(entry.stopId) ?? stopTimesByStop.set(entry.stopId, []).get(entry.stopId)!
    ).push(entry);
    (
      stopTimesByTrip.get(entry.tripId) ?? stopTimesByTrip.set(entry.tripId, []).get(entry.tripId)!
    ).push(entry);
  }
  for (const list of stopTimesByStop.values()) list.sort((a, b) => a.sequence - b.sequence);
  for (const list of stopTimesByTrip.values()) list.sort((a, b) => a.sequence - b.sequence);

  const calendar = new Map<string, GtfsCalendarRecord>();
  for (const row of parseCsv(files['calendar.txt']!)) {
    if (!row.service_id) continue;
    calendar.set(row.service_id, {
      serviceId: row.service_id,
      weekday: [
        toBool01(row.monday ?? '0'),
        toBool01(row.tuesday ?? '0'),
        toBool01(row.wednesday ?? '0'),
        toBool01(row.thursday ?? '0'),
        toBool01(row.friday ?? '0'),
        toBool01(row.saturday ?? '0'),
        toBool01(row.sunday ?? '0'),
      ],
      startDate: row.start_date ?? '00000000',
      endDate: row.end_date ?? '99991231',
    });
  }

  const calendarExceptions = new Map<string, Map<string, GtfsExceptionType>>();
  if (files['calendar_dates.txt']) {
    for (const row of parseCsv(files['calendar_dates.txt'])) {
      if (!row.service_id || !row.date) continue;
      const type = Number(row.exception_type) as GtfsExceptionType;
      if (type !== 1 && type !== 2) continue;
      const byDate = calendarExceptions.get(row.service_id) ?? new Map<string, GtfsExceptionType>();
      byDate.set(row.date, type);
      calendarExceptions.set(row.service_id, byDate);
    }
  }

  return {
    releaseTag,
    agencyName,
    routes,
    stops,
    trips,
    stopTimesByStop,
    stopTimesByTrip,
    calendar,
    calendarExceptions,
  };
}

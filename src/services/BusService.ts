import type { GtfsDataSource } from '../repositories/GtfsRepository.js';
import type {
  BusLine,
  BusStop,
  NearestStopResult,
  NextBusEntry,
  StopNextBuses,
} from '../domain/bus.js';
import type { GtfsRoute, GtfsStop, GtfsStopTime } from '../adapters/gtfsAdapter.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { distanceMeters } from '../utils/geo.js';
import { isServiceActiveOn } from '../utils/gtfsCalendar.js';
import { addDays, nowPartsInMadrid, toGtfsDate } from '../utils/date.js';

export interface BusResult<T> {
  data: T;
  stale: boolean;
}

function toBusLine(route: GtfsRoute): BusLine {
  return { id: route.id, shortName: route.shortName, longName: route.longName, color: route.color };
}

function toBusStop(stop: GtfsStop): BusStop {
  return {
    id: stop.id,
    name: stop.name,
    location: { latitude: stop.latitude, longitude: stop.longitude },
    wheelchairAccessible: stop.wheelchairBoarding,
  };
}

function formatHHMM(secondsSinceMidnight: number): string {
  const totalMinutes = Math.floor((secondsSinceMidnight % 86400) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export class BusService {
  constructor(private readonly repo: GtfsDataSource) {}

  async listLines(): Promise<BusResult<BusLine[]>> {
    const { data, stale } = await this.repo.get();
    return { data: [...data.routes.values()].map(toBusLine), stale };
  }

  async getLine(id: string): Promise<BusResult<BusLine>> {
    const { data, stale } = await this.repo.get();
    const route = data.routes.get(id);
    if (!route) {
      throw new NotFoundError(
        `No existe la línea "${id}". Líneas disponibles: ${[...data.routes.keys()].join(', ')}.`,
      );
    }
    return { data: toBusLine(route), stale };
  }

  async listStops(): Promise<BusResult<BusStop[]>> {
    const { data, stale } = await this.repo.get();
    return { data: [...data.stops.values()].map(toBusStop), stale };
  }

  async getStop(id: string): Promise<BusResult<BusStop>> {
    const { data, stale } = await this.repo.get();
    const stop = data.stops.get(id);
    if (!stop) {
      throw new NotFoundError(`No existe ninguna parada con id "${id}".`);
    }
    return { data: toBusStop(stop), stale };
  }

  async nearest(latitude: number, longitude: number): Promise<BusResult<NearestStopResult>> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new ValidationError(
        'Los parámetros "lat" y "lon" son obligatorios y deben ser numéricos.',
      );
    }

    const { data, stale } = await this.repo.get();
    if (data.stops.size === 0) {
      throw new NotFoundError('No hay paradas cargadas en el feed GTFS.');
    }

    let nearestStop: GtfsStop | undefined;
    let minDistance = Infinity;
    for (const stop of data.stops.values()) {
      const d = distanceMeters(
        { latitude, longitude },
        { latitude: stop.latitude, longitude: stop.longitude },
      );
      if (d < minDistance) {
        minDistance = d;
        nearestStop = stop;
      }
    }
    // Inalcanzable: ya hemos comprobado que data.stops.size > 0.
    const found = nearestStop!;

    const lineIds = new Set<string>();
    for (const st of data.stopTimesByStop.get(found.id) ?? []) {
      const trip = data.trips.get(st.tripId);
      if (trip) lineIds.add(trip.routeId);
    }
    const lines = [...lineIds]
      .map((routeId) => data.routes.get(routeId))
      .filter((r): r is GtfsRoute => r !== undefined)
      .map((r) => ({ id: r.id, shortName: r.shortName }));

    return {
      data: { stop: toBusStop(found), distanceMeters: Math.round(minDistance), lines },
      stale,
    };
  }

  async nextBuses(stopId: string, count = 2): Promise<BusResult<StopNextBuses>> {
    const { data, stale } = await this.repo.get();
    const stop = data.stops.get(stopId);
    if (!stop) {
      throw new NotFoundError(`No existe ninguna parada con id "${stopId}".`);
    }

    const { isoDate: today, secondsSinceMidnight: nowSeconds } = nowPartsInMadrid();
    const yesterday = addDays(today, -1);

    const candidates: { stopTime: GtfsStopTime; absoluteSeconds: number }[] = [];
    const stopTimes = data.stopTimesByStop.get(stopId) ?? [];

    for (const st of stopTimes) {
      const trip = data.trips.get(st.tripId);
      if (!trip) continue;
      const calendar = data.calendar.get(trip.serviceId);
      const exceptions = data.calendarExceptions.get(trip.serviceId);

      // Caso normal: el servicio es "de hoy" y la hora (0-23:59:59) aún no ha pasado.
      if (
        isServiceActiveOn(calendar, exceptions, toGtfsDate(today)) &&
        st.departureSeconds >= nowSeconds
      ) {
        candidates.push({ stopTime: st, absoluteSeconds: st.departureSeconds });
      }
      // Caso de cruce de medianoche: el servicio empezó "ayer" y la hora
      // codificada es >=24:00:00 (spec GTFS), cayendo dentro del día de hoy.
      if (
        st.departureSeconds >= 86400 &&
        isServiceActiveOn(calendar, exceptions, toGtfsDate(yesterday))
      ) {
        const secondsIntoToday = st.departureSeconds - 86400;
        if (secondsIntoToday >= nowSeconds) {
          candidates.push({ stopTime: st, absoluteSeconds: secondsIntoToday });
        }
      }
    }

    candidates.sort((a, b) => a.absoluteSeconds - b.absoluteSeconds);

    const nextBuses: NextBusEntry[] = candidates
      .slice(0, count)
      .map(({ stopTime, absoluteSeconds }) => {
        const trip = data.trips.get(stopTime.tripId)!;
        const route = data.routes.get(trip.routeId);
        return {
          line: route?.shortName ?? trip.routeId,
          destination: trip.headsign,
          scheduledTime: formatHHMM(absoluteSeconds),
          minutesUntil: Math.round((absoluteSeconds - nowSeconds) / 60),
        };
      });

    return { data: { stop: toBusStop(stop), nextBuses }, stale };
  }
}

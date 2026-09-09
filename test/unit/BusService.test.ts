import { describe, expect, it, vi } from 'vitest';
import { BusService } from '../../src/services/BusService.js';
import { toGtfsData } from '../../src/adapters/gtfsAdapter.js';
import type { GtfsDataSource } from '../../src/repositories/GtfsRepository.js';
import { NotFoundError, ValidationError } from '../../src/errors/AppError.js';
import * as dateUtils from '../../src/utils/date.js';

// Un miércoles real (2026-09-09) con servicio L-V activo. La parada 1 tiene
// dos salidas hoy (09:00 y 09:05) y una salida de un servicio "S" que hoy
// no está activo (no debe aparecer).
const files = {
  'agency.txt': 'agency_id,agency_name\nbus_aranda,UTE Test\n',
  'routes.txt':
    'route_id,agency_id,route_short_name,route_long_name,route_color\n1,bus_aranda,L1,Aranda (Circular),F31212\n2,bus_aranda,L2,Aranda - Poligono,05A0C7\n',
  'stops.txt':
    'stop_id,stop_name,stop_lat,stop_lon\n1,Ambulatorio Norte,41.6724,-3.6796\n2,Plaza Mayor,41.6701,-3.6885\n',
  'trips.txt':
    'trip_id,route_id,service_id,trip_headsign\nT1,1,L-V,Aranda (Amb. Norte)\nT2,1,L-V,Aranda (Amb. Norte)\nT3,2,S,Poligono\n',
  'stop_times.txt':
    'trip_id,stop_id,stop_sequence,arrival_time,departure_time\n' +
    'T1,1,1,09:00:00,09:00:00\n' +
    'T2,1,1,09:30:00,09:30:00\n' +
    'T3,1,1,10:00:00,10:00:00\n',
  'calendar.txt':
    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
    'L-V,1,1,1,1,1,0,0,20251201,20281209\n' +
    'S,0,0,0,0,0,1,0,20251201,20281209\n',
  'calendar_dates.txt': 'service_id,date,exception_type\n',
};

function fakeSource(): GtfsDataSource {
  const data = toGtfsData(files, 'v-test');
  return { get: async () => ({ data, stale: false }) };
}

describe('BusService', () => {
  it('lista las líneas', async () => {
    const service = new BusService(fakeSource());
    const { data } = await service.listLines();
    expect(data.map((l) => l.shortName)).toEqual(['L1', 'L2']);
  });

  it('getLine lanza NotFoundError para una línea inexistente', async () => {
    const service = new BusService(fakeSource());
    await expect(service.getLine('99')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lista las paradas', async () => {
    const service = new BusService(fakeSource());
    const { data } = await service.listStops();
    expect(data).toHaveLength(2);
  });

  it('nearest encuentra la parada más cercana y sus líneas', async () => {
    const service = new BusService(fakeSource());
    const { data } = await service.nearest(41.6701, -3.6885); // justo la Plaza Mayor
    expect(data.stop.id).toBe('2');
  });

  it('nearest rechaza coordenadas no numéricas', async () => {
    const service = new BusService(fakeSource());
    await expect(service.nearest(NaN, -3.6885)).rejects.toBeInstanceOf(ValidationError);
  });

  it('nextBuses devuelve solo los viajes de servicios activos hoy, ordenados y con minutos restantes', async () => {
    vi.spyOn(dateUtils, 'nowPartsInMadrid').mockReturnValue({
      isoDate: '2026-09-09', // miércoles real, servicio L-V activo, S no
      secondsSinceMidnight: 8 * 3600, // 08:00 — antes de las dos salidas L-V
    });

    const service = new BusService(fakeSource());
    const { data } = await service.nextBuses('1', 2);

    expect(data.nextBuses).toHaveLength(2);
    expect(data.nextBuses[0]).toMatchObject({
      line: 'L1',
      scheduledTime: '09:00',
      minutesUntil: 60,
    });
    expect(data.nextBuses[1]).toMatchObject({
      line: 'L1',
      scheduledTime: '09:30',
      minutesUntil: 90,
    });
    // El viaje T3 (línea L2, servicio "S") no está activo un miércoles.
    expect(data.nextBuses.some((b) => b.line === 'L2')).toBe(false);

    vi.restoreAllMocks();
  });

  it('nextBuses lanza NotFoundError para una parada inexistente', async () => {
    const service = new BusService(fakeSource());
    await expect(service.nextBuses('no-existe')).rejects.toBeInstanceOf(NotFoundError);
  });
});

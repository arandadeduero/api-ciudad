import { describe, expect, it } from 'vitest';
import { toGtfsData } from '../../src/adapters/gtfsAdapter.js';
import { UpstreamError } from '../../src/errors/AppError.js';

const files = {
  'agency.txt':
    'agency_id,agency_name,agency_url,agency_timezone\nbus_aranda,UTE Test,https://example.com,Europe/Madrid\n',
  'routes.txt':
    'route_id,agency_id,route_short_name,route_long_name,route_color\n1,bus_aranda,L1,Aranda (Circular),F31212\n',
  'stops.txt':
    'stop_id,stop_name,stop_lat,stop_lon,wheelchair_boarding\n1,Ambulatorio Norte,41.6724,-3.6796,1\n2,Plaza Mayor,41.6701,-3.6885,\n',
  'trips.txt': 'trip_id,route_id,service_id,trip_headsign\nT1,1,L-V,Aranda (Amb. Norte)\n',
  'stop_times.txt':
    'trip_id,stop_id,stop_sequence,arrival_time,departure_time\nT1,1,1,09:00:00,09:00:00\nT1,2,2,09:05:00,09:05:00\n',
  'calendar.txt':
    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nL-V,1,1,1,1,1,0,0,20251201,20281209\n',
  'calendar_dates.txt': 'service_id,date,exception_type\nL-V,20260101,2\n',
};

describe('toGtfsData', () => {
  it('parsea todas las entidades y construye los índices', () => {
    const data = toGtfsData(files, 'v-test');
    expect(data.releaseTag).toBe('v-test');
    expect(data.agencyName).toBe('UTE Test');
    expect(data.routes.get('1')).toMatchObject({ shortName: 'L1', color: 'F31212' });
    expect(data.stops.get('1')).toMatchObject({
      name: 'Ambulatorio Norte',
      wheelchairBoarding: true,
    });
    expect(data.stops.get('2')?.wheelchairBoarding).toBeNull();
    expect(data.trips.get('T1')).toMatchObject({ routeId: '1', serviceId: 'L-V' });
  });

  it('indexa los stop_times tanto por parada como por viaje, ordenados por secuencia', () => {
    const data = toGtfsData(files, 'v-test');
    expect(data.stopTimesByTrip.get('T1')).toHaveLength(2);
    expect(data.stopTimesByStop.get('1')).toHaveLength(1);
    expect(data.stopTimesByStop.get('1')![0]!.departureSeconds).toBe(9 * 3600);
  });

  it('parsea calendar.txt y calendar_dates.txt', () => {
    const data = toGtfsData(files, 'v-test');
    expect(data.calendar.get('L-V')).toMatchObject({ startDate: '20251201', endDate: '20281209' });
    expect(data.calendarExceptions.get('L-V')?.get('20260101')).toBe(2);
  });

  it('lanza UpstreamError si falta un fichero obligatorio', () => {
    const { 'stops.txt': _omitted, ...rest } = files;
    expect(() => toGtfsData(rest, 'v-test')).toThrow(UpstreamError);
  });
});

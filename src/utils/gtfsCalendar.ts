export interface GtfsCalendarRecord {
  serviceId: string;
  weekday: [boolean, boolean, boolean, boolean, boolean, boolean, boolean]; // lun..dom
  startDate: string; // YYYYMMDD
  endDate: string; // YYYYMMDD
}

/** 1 = servicio añadido ese día, 2 = servicio quitado ese día (spec GTFS calendar_dates.txt). */
export type GtfsExceptionType = 1 | 2;

const WEEKDAY_INDEX_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]; // getUTCDay(): 0=domingo

/** Convierte una fecha YYYYMMDD a día de la semana (0=lunes .. 6=domingo). */
export function weekdayIndexMondayFirst(dateYYYYMMDD: string): number {
  const y = Number(dateYYYYMMDD.slice(0, 4));
  const m = Number(dateYYYYMMDD.slice(4, 6));
  const d = Number(dateYYYYMMDD.slice(6, 8));
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=domingo..6=sábado
  return WEEKDAY_INDEX_MONDAY_FIRST.indexOf(jsDay);
}

/**
 * Resuelve si un `service_id` está activo en una fecha dada, combinando
 * calendar.txt (patrón semanal + rango de fechas) con las excepciones de
 * calendar_dates.txt (que siempre tienen prioridad para esa fecha exacta),
 * tal como especifica el estándar GTFS.
 */
export function isServiceActiveOn(
  calendar: GtfsCalendarRecord | undefined,
  exceptions: Map<string, GtfsExceptionType> | undefined,
  dateYYYYMMDD: string,
): boolean {
  const exception = exceptions?.get(dateYYYYMMDD);
  if (exception === 1) return true;
  if (exception === 2) return false;

  if (!calendar) return false;
  if (dateYYYYMMDD < calendar.startDate || dateYYYYMMDD > calendar.endDate) return false;

  return calendar.weekday[weekdayIndexMondayFirst(dateYYYYMMDD)] ?? false;
}

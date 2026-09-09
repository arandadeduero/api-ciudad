const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;

/** Valida formato YYYY-MM-DD y que sea una fecha de calendario real (rechaza 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
}

/** Valida formato YYYY-MM con mes entre 01 y 12. */
export function isValidYearMonth(value: string): boolean {
  if (!YEAR_MONTH_RE.test(value)) return false;
  const [, m] = value.split('-').map(Number);
  return m! >= 1 && m! <= 12;
}

/** Todas las fechas YYYY-MM-DD de un mes YYYY-MM dado, en orden. */
export function datesInMonth(yearMonth: string): string[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const days = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return `${y}-${String(m).padStart(2, '0')}-${day}`;
  });
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de Aranda de Duero. */
export function todayInMadrid(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

/** Suma N días a una fecha YYYY-MM-DD, devolviendo YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + days));
  return date.toISOString().slice(0, 10);
}

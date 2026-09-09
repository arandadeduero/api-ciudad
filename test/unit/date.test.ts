import { describe, expect, it } from 'vitest';
import { isValidIsoDate, isValidYearMonth, datesInMonth, addDays } from '../../src/utils/date.js';

describe('isValidIsoDate', () => {
  it('acepta fechas reales', () => {
    expect(isValidIsoDate('2026-01-01')).toBe(true);
    expect(isValidIsoDate('2026-12-31')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true); // bisiesto
  });

  it('rechaza formato inválido', () => {
    expect(isValidIsoDate('2026-1-1')).toBe(false);
    expect(isValidIsoDate('01-01-2026')).toBe(false);
    expect(isValidIsoDate('not-a-date')).toBe(false);
  });

  it('rechaza fechas de calendario inexistentes', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2025-02-29')).toBe(false); // no bisiesto
  });
});

describe('isValidYearMonth', () => {
  it('acepta meses válidos', () => {
    expect(isValidYearMonth('2026-01')).toBe(true);
    expect(isValidYearMonth('2026-12')).toBe(true);
  });

  it('rechaza formato o mes inválido', () => {
    expect(isValidYearMonth('2026-13')).toBe(false);
    expect(isValidYearMonth('2026-00')).toBe(false);
    expect(isValidYearMonth('2026')).toBe(false);
  });
});

describe('datesInMonth', () => {
  it('devuelve todos los días del mes en orden', () => {
    expect(datesInMonth('2026-02')).toHaveLength(28);
    expect(datesInMonth('2026-04')).toHaveLength(30);
    expect(datesInMonth('2026-01')[0]).toBe('2026-01-01');
    expect(datesInMonth('2026-01').at(-1)).toBe('2026-01-31');
  });
});

describe('addDays', () => {
  it('suma días dentro del mismo mes', () => {
    expect(addDays('2026-01-01', 5)).toBe('2026-01-06');
  });

  it('cruza el límite de mes y de año', () => {
    expect(addDays('2026-01-30', 5)).toBe('2026-02-04');
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
  });
});

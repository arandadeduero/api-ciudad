import { describe, expect, it } from 'vitest';
import {
  isServiceActiveOn,
  weekdayIndexMondayFirst,
  type GtfsCalendarRecord,
} from '../../src/utils/gtfsCalendar.js';

describe('weekdayIndexMondayFirst', () => {
  it('2026-09-09 es miércoles (índice 2)', () => {
    expect(weekdayIndexMondayFirst('20260909')).toBe(2);
  });

  it('2026-09-07 es lunes (índice 0)', () => {
    expect(weekdayIndexMondayFirst('20260907')).toBe(0);
  });

  it('2026-09-13 es domingo (índice 6)', () => {
    expect(weekdayIndexMondayFirst('20260913')).toBe(6);
  });
});

describe('isServiceActiveOn', () => {
  const lv: GtfsCalendarRecord = {
    serviceId: 'L-V',
    weekday: [true, true, true, true, true, false, false],
    startDate: '20251201',
    endDate: '20281209',
  };

  it('activo un miércoles dentro del rango', () => {
    expect(isServiceActiveOn(lv, undefined, '20260909')).toBe(true);
  });

  it('inactivo en sábado (fuera del patrón semanal)', () => {
    expect(isServiceActiveOn(lv, undefined, '20260912')).toBe(false);
  });

  it('inactivo fuera del rango de fechas', () => {
    expect(isServiceActiveOn(lv, undefined, '20200101')).toBe(false);
  });

  it('una excepción tipo 2 desactiva un día que normalmente estaría activo', () => {
    const exceptions = new Map([['20260101', 2 as const]]);
    expect(isServiceActiveOn(lv, exceptions, '20260101')).toBe(false);
  });

  it('una excepción tipo 1 activa un día que normalmente no lo estaría (sábado)', () => {
    const exceptions = new Map([['20260912', 1 as const]]);
    expect(isServiceActiveOn(lv, exceptions, '20260912')).toBe(true);
  });

  it('sin calendar y sin excepción, siempre inactivo', () => {
    expect(isServiceActiveOn(undefined, undefined, '20260909')).toBe(false);
  });
});

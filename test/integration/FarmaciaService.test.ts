import { describe, expect, it } from 'vitest';
import { FarmaciaService } from '../../src/services/FarmaciaService.js';
import { FarmaciaRepository } from '../../src/repositories/FarmaciaRepository.js';
import { ValidationError, NotFoundError } from '../../src/errors/AppError.js';

// Test de integración: usa los ficheros reales de data/ (no un fixture),
// porque son datos reales que ya viven en el repo (ver DATA-SOURCES.md).
const service = new FarmaciaService(new FarmaciaRepository());

describe('FarmaciaService', () => {
  it('lista las 12 farmacias del catálogo', async () => {
    const pharmacies = await service.listPharmacies();
    expect(pharmacies).toHaveLength(12);
    expect(pharmacies[0]).toHaveProperty('name');
    expect(pharmacies[0]).toHaveProperty('location.latitude');
  });

  it('devuelve la farmacia de guardia de una fecha conocida', async () => {
    const entry = await service.getForDate('2026-01-01');
    expect(entry.date).toBe('2026-01-01');
    expect(entry.pharmacy.id).toBe(9);
    expect(entry.holiday).toMatchObject({ name: 'Año Nuevo', scope: 'nacional' });
    expect(entry.lowConfidence).toBe(false);
  });

  it('marca como lowConfidence las fechas documentadas como de baja confianza', async () => {
    const entry = await service.getForDate('2026-12-24');
    expect(entry.lowConfidence).toBe(true);
  });

  it('devuelve holiday=null para un día sin festivo', async () => {
    const entry = await service.getForDate('2026-01-02');
    expect(entry.holiday).toBeNull();
  });

  it('rechaza una fecha con formato inválido', async () => {
    await expect(service.getForDate('2026-1-1')).rejects.toBeInstanceOf(ValidationError);
  });

  it('rechaza una fecha de calendario inexistente', async () => {
    await expect(service.getForDate('2026-02-30')).rejects.toBeInstanceOf(ValidationError);
  });

  it('devuelve 404 para un año sin calendario cargado', async () => {
    await expect(service.getForDate('2027-01-01')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('devuelve las 31 entradas de un mes completo', async () => {
    const entries = await service.getForMonth('2026-01');
    expect(entries).toHaveLength(31);
    expect(entries[0]!.date).toBe('2026-01-01');
    expect(entries.at(-1)!.date).toBe('2026-01-31');
  });

  it('rechaza un mes con formato inválido', async () => {
    await expect(service.getForMonth('2026-13')).rejects.toBeInstanceOf(ValidationError);
  });

  it('getToday devuelve una entrada válida para la fecha actual', async () => {
    const entry = await service.getToday();
    expect(entry.pharmacy).toBeDefined();
  });

  it('getDashboard devuelve hoy y los próximos días', async () => {
    const dashboard = await service.getDashboard(3);
    expect(dashboard.today.pharmacy).toBeDefined();
    expect(dashboard.upcoming.length).toBeGreaterThan(0);
    expect(dashboard.upcoming.length).toBeLessThanOrEqual(3);
  });
});

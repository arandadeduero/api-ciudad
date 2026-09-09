import type { FarmaciaRepository } from '../repositories/FarmaciaRepository.js';
import type { GuardEntry, Pharmacy } from '../domain/farmacia.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import {
  isValidIsoDate,
  isValidYearMonth,
  datesInMonth,
  todayInMadrid,
  addDays,
} from '../utils/date.js';

export interface DashboardResult {
  today: GuardEntry;
  upcoming: GuardEntry[];
}

export class FarmaciaService {
  constructor(private readonly repo: FarmaciaRepository) {}

  async listPharmacies(): Promise<Pharmacy[]> {
    const { pharmacies } = await this.repo.get();
    return [...pharmacies.values()].sort((a, b) => a.id - b.id);
  }

  async getForDate(dateStr: string): Promise<GuardEntry> {
    if (!isValidIsoDate(dateStr)) {
      throw new ValidationError(
        `Fecha inválida: "${dateStr}". Formato esperado: YYYY-MM-DD.`,
        'INVALID_DATE',
      );
    }

    const { pharmacies, scheduleByDate, lowConfidenceDates, holidaysByDate, guardYears } =
      await this.repo.get();

    const year = Number(dateStr.slice(0, 4));
    if (!guardYears.has(year)) {
      throw new NotFoundError(
        `No hay calendario de guardias cargado para el año ${year}. Años disponibles: ${[...guardYears].join(', ')}.`,
        'YEAR_NOT_AVAILABLE',
      );
    }

    const pharmacyId = scheduleByDate.get(dateStr);
    if (pharmacyId === undefined) {
      throw new NotFoundError(`No hay farmacia de guardia registrada para ${dateStr}.`);
    }

    const pharmacy = pharmacies.get(pharmacyId);
    if (!pharmacy) {
      // Inconsistencia de datos (el calendario apunta a una farmacia que no
      // está en el catálogo) — no debería ocurrir con los ficheros actuales,
      // pero si ocurriera es un 500, no un 404: es un problema nuestro, no
      // del cliente que pregunta por una fecha válida.
      throw new Error(`Inconsistencia de datos: farmacia ${pharmacyId} no existe en el catálogo.`);
    }

    return {
      date: dateStr,
      pharmacy,
      holiday: holidaysByDate.get(dateStr) ?? null,
      lowConfidence: lowConfidenceDates.has(dateStr),
    };
  }

  async getForMonth(monthStr: string): Promise<GuardEntry[]> {
    if (!isValidYearMonth(monthStr)) {
      throw new ValidationError(
        `Mes inválido: "${monthStr}". Formato esperado: YYYY-MM.`,
        'INVALID_MONTH',
      );
    }

    const year = Number(monthStr.slice(0, 4));
    const { guardYears } = await this.repo.get();
    if (!guardYears.has(year)) {
      throw new NotFoundError(
        `No hay calendario de guardias cargado para el año ${year}. Años disponibles: ${[...guardYears].join(', ')}.`,
        'YEAR_NOT_AVAILABLE',
      );
    }

    const dates = datesInMonth(monthStr);
    return Promise.all(dates.map((d) => this.getForDate(d)));
  }

  async getToday(): Promise<GuardEntry> {
    return this.getForDate(todayInMadrid());
  }

  async getDashboard(days = 5): Promise<DashboardResult> {
    const today = await this.getToday();
    const upcoming: GuardEntry[] = [];
    for (let i = 1; i <= days; i++) {
      const date = addDays(today.date, i);
      try {
        upcoming.push(await this.getForDate(date));
      } catch (err) {
        if (err instanceof NotFoundError) break; // se acabó el calendario disponible
        throw err;
      }
    }
    return { today, upcoming };
  }
}

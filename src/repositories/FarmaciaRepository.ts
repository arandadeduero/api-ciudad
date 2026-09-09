import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { z } from 'zod';
import type { Pharmacy, Holiday } from '../domain/farmacia.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

const pharmacySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  address: z.string().min(1),
  postalCode: z.string(),
  city: z.string(),
  zone: z.string().nullable(),
  phone: z.string(),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
});

const farmaciasFileSchema = z.object({
  meta: z.object({}).passthrough(),
  pharmacies: z.array(pharmacySchema),
});

const scheduleEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pharmacyId: z.number().int().positive(),
});

const scheduleFileSchema = z.object({
  meta: z
    .object({
      lowConfidenceDates: z.array(z.string()).default([]),
    })
    .passthrough(),
  schedule: z.array(scheduleEntrySchema),
});

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string(),
  scope: z.enum(['nacional', 'autonomico']),
});

const festivosFileSchema = z.object({
  meta: z.object({}).passthrough(),
  holidays: z.array(holidaySchema),
});

export interface FarmaciaData {
  pharmacies: Map<number, Pharmacy>;
  scheduleByDate: Map<string, number>;
  lowConfidenceDates: Set<string>;
  holidaysByDate: Map<string, Holiday>;
  guardYears: Set<number>;
}

/**
 * Repositorio de farmacias: carga y valida los ficheros estáticos de
 * data/. Son datos reales (extraídos de fuentes oficiales, ver
 * DATA-SOURCES.md), no fixtures — pero se validan igual que cualquier
 * fuente externa (§15 del prompt maestro: no confiar ciegamente ni en
 * nuestros propios ficheros).
 */
export class FarmaciaRepository {
  private cache: Promise<FarmaciaData> | undefined;

  private async load(): Promise<FarmaciaData> {
    const [farmaciasRaw, scheduleRaw, festivosRaw] = await Promise.all([
      readFile(join(DATA_DIR, 'farmacias.json'), 'utf-8'),
      readFile(join(DATA_DIR, 'farmacias-guardia-2026.json'), 'utf-8'),
      readFile(join(DATA_DIR, 'festivos-2026.json'), 'utf-8'),
    ]);

    const farmacias = farmaciasFileSchema.parse(JSON.parse(farmaciasRaw));
    const schedule = scheduleFileSchema.parse(JSON.parse(scheduleRaw));
    const festivos = festivosFileSchema.parse(JSON.parse(festivosRaw));

    const pharmacies = new Map(farmacias.pharmacies.map((p) => [p.id, p]));
    const scheduleByDate = new Map(schedule.schedule.map((s) => [s.date, s.pharmacyId]));
    const lowConfidenceDates = new Set(schedule.meta.lowConfidenceDates);
    const holidaysByDate = new Map(festivos.holidays.map((h) => [h.date, h]));
    const guardYears = new Set(schedule.schedule.map((s) => Number(s.date.slice(0, 4))));

    return { pharmacies, scheduleByDate, lowConfidenceDates, holidaysByDate, guardYears };
  }

  /** Memoiza la carga: los ficheros son estáticos durante la vida del proceso. */
  async get(): Promise<FarmaciaData> {
    if (!this.cache) {
      this.cache = this.load();
    }
    return this.cache;
  }
}

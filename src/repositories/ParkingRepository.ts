import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { z } from 'zod';
import type { OraDistrict, OraInfo, PublicParking } from '../domain/parking.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

const scheduleBlockSchema = z.array(z.object({ from: z.string(), to: z.string() }));

const parkingFileSchema = z.object({
  meta: z.object({}).passthrough(),
  ora: z.object({
    schedule: z.object({
      mondayToFriday: scheduleBlockSchema,
      saturday: scheduleBlockSchema,
      sunday: scheduleBlockSchema,
      exception: z.object({
        location: z.string(),
        mondayToSaturday: scheduleBlockSchema,
      }),
    }),
    exemptPeriods: z.array(z.object({ description: z.string(), dynamic: z.boolean().optional() })),
    duration: z.object({
      residents: z.string(),
      nonResidentsDefault: z.object({ zone: z.string(), maxMinutes: z.number() }),
      greenZone: z.object({ maxMinutes: z.number(), streets: z.array(z.string()) }),
    }),
    exemptVehicles: z.array(z.string()),
    districts: z.array(
      z.object({
        id: z.string(),
        streets: z.array(z.string()),
        note: z.string().optional(),
      }),
    ),
  }),
  publicParkings: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.literal('public'),
      address: z.string(),
      postalCode: z.string(),
      city: z.string(),
      location: z.object({ latitude: z.number(), longitude: z.number() }),
      hours: z.string(),
      capacity: z.number().nullable(),
      availableSpaces: z.number().nullable(),
      availabilityStatus: z.literal('NOT_AVAILABLE'),
      phone: z.string().nullable(),
    }),
  ),
});

export interface ParkingData {
  ora: OraInfo;
  publicParkings: PublicParking[];
}

/** Repositorio de parking/ORA: dataset estático real, ver DATA-SOURCES.md. */
export class ParkingRepository {
  private cache: Promise<ParkingData> | undefined;

  private async load(): Promise<ParkingData> {
    const raw = await readFile(join(DATA_DIR, 'parking.json'), 'utf-8');
    const parsed = parkingFileSchema.parse(JSON.parse(raw));

    const districts: OraDistrict[] = parsed.ora.districts.map((d) => ({
      id: d.id,
      streets: d.streets,
      note: d.note ?? null,
    }));

    return {
      ora: { ...parsed.ora, districts },
      publicParkings: parsed.publicParkings,
    };
  }

  async get(): Promise<ParkingData> {
    if (!this.cache) this.cache = this.load();
    return this.cache;
  }
}

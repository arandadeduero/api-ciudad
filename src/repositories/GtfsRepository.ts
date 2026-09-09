import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GtfsProvider } from '../clients/GtfsClient.js';
import { toGtfsData, type GtfsData } from '../adapters/gtfsAdapter.js';
import { UpstreamError } from '../errors/AppError.js';

const MANIFEST_FILE = 'manifest.json';

export interface GtfsResult {
  data: GtfsData;
  /** true si se ha servido desde la caché en disco porque la descarga del feed real falló. */
  stale: boolean;
}

/** Contrato mínimo que necesita BusService — permite testear con un doble sin red ni disco. */
export interface GtfsDataSource {
  get(): Promise<GtfsResult>;
}

/**
 * Repositorio del feed GTFS urbano. Persiste el feed descargado en disco
 * (`cacheDir`) para poder arrancar sin red y como fallback "stale" si
 * GitHub Releases no responde — mismo patrón de resiliencia que el resto
 * de servicios (cache + fallback en vez de tumbar la request), pero en
 * disco en vez de en el CacheService porque el feed pesa demasiado para
 * ir dando vueltas en memoria una vez ya parseado en índices.
 */
export class GtfsRepository implements GtfsDataSource {
  private cache: Promise<GtfsResult> | undefined;

  constructor(
    private readonly client: GtfsProvider,
    private readonly cacheDir: string,
  ) {}

  async get(): Promise<GtfsResult> {
    if (!this.cache) this.cache = this.load();
    return this.cache;
  }

  private async load(): Promise<GtfsResult> {
    try {
      const feed = await this.client.fetchLatestFeed();
      await this.persistToDisk(feed.releaseTag, feed.files).catch(() => {
        // best-effort: si no se puede escribir a disco (p. ej. filesystem
        // de solo lectura), seguimos sirviendo el feed en memoria igual.
      });
      return { data: toGtfsData(feed.files, feed.releaseTag), stale: false };
    } catch (err) {
      const cached = await this.tryLoadFromDisk();
      if (cached) return { data: cached, stale: true };
      throw err instanceof UpstreamError
        ? err
        : new UpstreamError('No se pudo obtener el feed GTFS.', 'GTFS_UNAVAILABLE');
    }
  }

  private async persistToDisk(releaseTag: string, files: Record<string, string>): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
    await Promise.all(
      Object.entries(files).map(([name, content]) =>
        writeFile(join(this.cacheDir, name), content, 'utf-8'),
      ),
    );
    await writeFile(
      join(this.cacheDir, MANIFEST_FILE),
      JSON.stringify({ releaseTag, savedAt: new Date().toISOString() }),
      'utf-8',
    );
  }

  private async tryLoadFromDisk(): Promise<GtfsData | undefined> {
    try {
      const manifestRaw = await readFile(join(this.cacheDir, MANIFEST_FILE), 'utf-8');
      const manifest = JSON.parse(manifestRaw) as { releaseTag: string };

      const names = [
        'agency.txt',
        'stops.txt',
        'routes.txt',
        'trips.txt',
        'stop_times.txt',
        'calendar.txt',
        'calendar_dates.txt',
      ];
      const files: Record<string, string> = {};
      for (const name of names) {
        try {
          files[name] = await readFile(join(this.cacheDir, name), 'utf-8');
        } catch {
          // calendar_dates.txt es opcional; el resto se validan en toGtfsData
        }
      }
      return toGtfsData(files, manifest.releaseTag);
    } catch {
      return undefined;
    }
  }
}

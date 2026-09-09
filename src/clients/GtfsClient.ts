import { unzipSync } from 'fflate';
import { UpstreamError } from '../errors/AppError.js';

export interface GtfsFeed {
  releaseTag: string;
  /** Contenido en texto plano de cada fichero .txt del feed, indexado por nombre. */
  files: Record<string, string>;
}

export interface GtfsProvider {
  fetchLatestFeed(): Promise<GtfsFeed>;
}

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  assets: GithubReleaseAsset[];
}

/** Ficheros GTFS que nos interesan; el resto del zip (p. ej. shapes.txt, si no se usa) se ignora. */
const GTFS_FILES = [
  'agency.txt',
  'stops.txt',
  'routes.txt',
  'trips.txt',
  'stop_times.txt',
  'calendar.txt',
  'calendar_dates.txt',
] as const;

/**
 * Cliente para el feed GTFS real del bus urbano de Aranda de Duero,
 * distribuido como asset de GitHub Releases (ver docs/architecture-proposal.md §2.1b).
 *
 * No escribe nada a disco por sí mismo: `unzipSync` de fflate trabaja en
 * memoria, así que no hay superficie de ataque de path traversal / symlinks
 * al extraer un ZIP de un tercero (a diferencia de librerías que extraen
 * directamente al filesystem).
 */
export class GtfsClient implements GtfsProvider {
  constructor(
    private readonly repo: string,
    private readonly timeoutMs = 10_000,
  ) {}

  async fetchLatestFeed(): Promise<GtfsFeed> {
    const release = await this.fetchJson<GithubRelease>(
      `https://api.github.com/repos/${this.repo}/releases/latest`,
    );

    const asset = release.assets.find((a) => a.name.endsWith('.zip'));
    if (!asset) {
      throw new UpstreamError(
        `El release ${release.tag_name} de ${this.repo} no tiene ningún asset .zip`,
        'GTFS_NO_ASSET',
      );
    }

    const zipBytes = await this.fetchBytes(asset.browser_download_url);

    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(zipBytes, {
        filter: (entry) => (GTFS_FILES as readonly string[]).includes(entry.name),
      });
    } catch (err) {
      throw new UpstreamError(
        `No se pudo descomprimir el feed GTFS de ${this.repo}: ${(err as Error).message}`,
        'GTFS_UNZIP_ERROR',
      );
    }

    const decoder = new TextDecoder('utf-8');
    const files: Record<string, string> = {};
    for (const name of GTFS_FILES) {
      const bytes = unzipped[name];
      if (bytes) files[name] = decoder.decode(bytes);
    }

    if (!files['stops.txt'] || !files['trips.txt'] || !files['stop_times.txt']) {
      throw new UpstreamError(
        `El feed GTFS de ${this.repo} no contiene los ficheros mínimos esperados (stops/trips/stop_times.txt)`,
        'GTFS_INCOMPLETE_FEED',
      );
    }

    return { releaseTag: release.tag_name, files };
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await this.fetchWithTimeout(url);
    return (await res.json()) as T;
  }

  private async fetchBytes(url: string): Promise<Uint8Array> {
    const res = await this.fetchWithTimeout(url);
    return new Uint8Array(await res.arrayBuffer());
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new UpstreamError(
          `GTFS (${this.repo}) respondió ${res.status} para ${url}`,
          'GTFS_ERROR',
        );
      }
      return res;
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new UpstreamError(`Timeout al consultar ${url}`, 'GTFS_TIMEOUT');
      }
      throw new UpstreamError(
        `Error de red al consultar ${url}: ${(err as Error).message}`,
        'GTFS_NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

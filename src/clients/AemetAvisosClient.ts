import { UpstreamError } from '../errors/AppError.js';
import { withExternalRequestMetrics } from '../telemetry/metrics.js';
import { readTarEntries } from '../utils/tar.js';

const METRIC_SOURCE = 'aemet-avisos';

export interface AvisosProvider {
  fetchAvisos(area: string): Promise<string[]>;
}

interface AemetEnvelope {
  estado: number;
  descripcion: string;
  datos?: string;
}

/**
 * Cliente para "Avisos de Fenómenos Meteorológicos Adversos" de AEMET
 * OpenData — distinto del endpoint de predicción (que no usamos, ver
 * docs/architecture-proposal.md §2.3). Sigue el patrón en dos pasos típico
 * de AEMET OpenData: la llamada con `api_key` no devuelve los datos
 * directamente, sino una URL a la que hacer un segundo `GET` (confirmado
 * contra el spec oficial y en vivo, 2026-09-09). Esa segunda respuesta es
 * un TAR sin comprimir con un fichero CAP-XML por fenómeno (viento, nieve,
 * lluvia...) — pese a que la cabecera `Content-Disposition` lo llama
 * "*.tar.gz", no lleva compresión gzip encima (comprobado con `file` sobre
 * un fichero real).
 */
export class AemetAvisosClient implements AvisosProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 10_000,
  ) {}

  async fetchAvisos(area: string): Promise<string[]> {
    return withExternalRequestMetrics(METRIC_SOURCE, () => this.doFetchAvisos(area));
  }

  private async doFetchAvisos(area: string): Promise<string[]> {
    if (!this.apiKey) {
      throw new UpstreamError(
        'AEMET_API_KEY no está configurada. Pide una key gratuita en https://opendata.aemet.es.',
        'AVISOS_NOT_CONFIGURED',
      );
    }

    const envelope = await this.fetchJson<AemetEnvelope>(
      `${this.baseUrl}/avisos_cap/ultimoelaborado/area/${encodeURIComponent(area)}`,
    );
    if (!envelope.datos) {
      throw new UpstreamError(
        `AEMET no devolvió URL de datos para el área "${area}" (estado ${envelope.estado}: ${envelope.descripcion}).`,
        'AVISOS_UNEXPECTED_SHAPE',
      );
    }

    const tarBuffer = await this.fetchBytes(envelope.datos);
    const entries = readTarEntries(tarBuffer);
    if (entries.length === 0) {
      throw new UpstreamError(
        `El paquete de avisos de AEMET para el área "${area}" no contiene ningún fichero.`,
        'AVISOS_UNEXPECTED_SHAPE',
      );
    }

    const decoder = new TextDecoder('utf-8');
    return entries.map((entry) => decoder.decode(entry.content));
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await this.fetchWithTimeout(url, { api_key: this.apiKey });
    return (await res.json()) as T;
  }

  private async fetchBytes(url: string): Promise<Uint8Array> {
    const res = await this.fetchWithTimeout(url);
    return new Uint8Array(await res.arrayBuffer());
  }

  private async fetchWithTimeout(url: string, headers?: Record<string, string>): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(
        url,
        headers ? { signal: controller.signal, headers } : { signal: controller.signal },
      );
      if (!res.ok) {
        throw new UpstreamError(`AEMET respondió ${res.status} para ${url}`, 'AVISOS_ERROR');
      }
      return res;
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new UpstreamError(`Timeout al consultar AEMET (${url})`, 'AVISOS_TIMEOUT');
      }
      throw new UpstreamError(
        `Error de red al consultar AEMET: ${(err as Error).message}`,
        'AVISOS_NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

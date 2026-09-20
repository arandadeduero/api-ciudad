import { UpstreamError } from '../errors/AppError.js';
import { withExternalRequestMetrics } from '../telemetry/metrics.js';
import { withSingleRetry } from '../utils/httpRetry.js';

const METRIC_SOURCE = 'jcyl';

export interface JcylProvider {
  fetchAllRecords(dataset: string, refine: Record<string, string>): Promise<unknown[]>;
}

interface OpendatasoftRecordsResponse {
  total_count: number;
  results: unknown[];
}

const PAGE_SIZE = 100;
/** Límite defensivo: evita bucles de paginación descontrolados si `total_count` es anómalo. */
const MAX_RECORDS = 5000;

/**
 * Cliente HTTP puro para la API Opendatasoft Explore v2.1 de JCyL
 * (analisis.datosabiertos.jcyl.es). Usa el parámetro `offset` para paginar
 * cuando `total_count` supera el `limit` de una página, tal como indicó el
 * usuario al aportar esta fuente (ver docs/architecture-proposal.md §2.2).
 */
export class JcylClient implements JcylProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 5000,
  ) {}

  async fetchAllRecords(dataset: string, refine: Record<string, string>): Promise<unknown[]> {
    const records: unknown[] = [];
    let offset = 0;

    for (;;) {
      const page = await this.fetchPage(dataset, refine, offset);
      records.push(...page.results);

      if (records.length >= page.total_count || page.results.length < PAGE_SIZE) break;
      if (records.length >= MAX_RECORDS) break;
      offset += PAGE_SIZE;
    }

    return records;
  }

  private async fetchPage(
    dataset: string,
    refine: Record<string, string>,
    offset: number,
  ): Promise<OpendatasoftRecordsResponse> {
    return withExternalRequestMetrics(METRIC_SOURCE, () =>
      withSingleRetry(() => this.doFetchPage(dataset, refine, offset)),
    );
  }

  private async doFetchPage(
    dataset: string,
    refine: Record<string, string>,
    offset: number,
  ): Promise<OpendatasoftRecordsResponse> {
    const url = new URL(`${this.baseUrl}/catalog/datasets/${dataset}/records`);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));
    for (const [field, value] of Object.entries(refine)) {
      url.searchParams.append('refine', `${field}:"${value}"`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new UpstreamError(`JCyL respondió ${res.status} para ${dataset}`, 'JCYL_ERROR');
      }
      const body = (await res.json()) as OpendatasoftRecordsResponse;
      if (typeof body.total_count !== 'number' || !Array.isArray(body.results)) {
        throw new UpstreamError(
          `Respuesta de JCyL con formato inesperado para ${dataset}`,
          'JCYL_UNEXPECTED_SHAPE',
        );
      }
      return body;
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new UpstreamError(`Timeout al consultar JCyL (${dataset})`, 'JCYL_TIMEOUT');
      }
      throw new UpstreamError(
        `Error de red al consultar JCyL: ${(err as Error).message}`,
        'JCYL_NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

import { UpstreamError } from '../errors/AppError.js';

export type RioMetricName = 'nivel' | 'caudal';

export interface RioRawReading {
  timestamp: string;
  value: number;
}

export interface RioProvider {
  fetchSeries(stationCode: string, metric: RioMetricName): Promise<RioRawReading[]>;
}

/**
 * Cliente para la API real de terceros que envuelve datos del SAIH de la
 * Confederación Hidrográfica del Duero (ver docs/architecture-proposal.md
 * §2.2b). No es la API oficial de la CHD — se documenta la procedencia en
 * cada respuesta (meta.source de la ruta).
 *
 * La API no admite filtros de fecha/paginación (probado en vivo): siempre
 * devuelve la ventana móvil completa que tenga cargada (~3 meses). El
 * recorte a "últimas N horas" lo hace el Service.
 */
export class RioClient implements RioProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 8000,
  ) {}

  async fetchSeries(stationCode: string, metric: RioMetricName): Promise<RioRawReading[]> {
    const url = `${this.baseUrl}/station/aforo/${encodeURIComponent(stationCode)}/${metric}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new UpstreamError(`API del río respondió ${res.status} para ${metric}`, 'RIO_ERROR');
      }
      const body = await res.json();
      if (!Array.isArray(body)) {
        throw new UpstreamError(
          `Respuesta de la API del río con formato inesperado para ${metric}`,
          'RIO_UNEXPECTED_SHAPE',
        );
      }
      // La API no valida el código de estación: uno inexistente devuelve
      // 200 con array vacío en vez de 404 (comprobado en vivo). Un array
      // vacío se propaga tal cual; el Service decide si es un error.
      return body
        .filter(
          (r): r is { d: string; v: number; '@timestamp': string } =>
            typeof r === 'object' &&
            r !== null &&
            typeof r.v === 'number' &&
            typeof r['@timestamp'] === 'string',
        )
        .map((r) => ({ timestamp: r['@timestamp'], value: r.v }));
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new UpstreamError(`Timeout al consultar la API del río (${metric})`, 'RIO_TIMEOUT');
      }
      throw new UpstreamError(
        `Error de red al consultar la API del río: ${(err as Error).message}`,
        'RIO_NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

import { parse } from 'node-html-parser';
import { UpstreamError } from '../errors/AppError.js';
import { withExternalRequestMetrics } from '../telemetry/metrics.js';
import type { EmbalseSnapshot } from '../domain/embalse.js';

const METRIC_SOURCE = 'saih-duero-embalse';

export interface EmbalseProvider {
  fetchEmbalse(stationCode: string): Promise<EmbalseSnapshot>;
}

/**
 * "907,67 m.s.n.m" -> 907.67. "54,4 hm3" -> 54.4. "n/d" o vacío -> null.
 * Nunca lanza: un campo no disponible es null, no un error. Los valores de
 * la ficha siempre llevan la unidad pegada al número (ver getStyles/tabla
 * en el HTML de origen), así que solo se toma la parte numérica inicial.
 */
function parseSpanishNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'n/d') return null;
  const match = /^-?[\d.]+(?:,\d+)?/.exec(trimmed);
  if (!match) return null;
  const normalized = match[0].replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Cliente para la ficha pública de un embalse del SAIH del Duero
 * (saihduero.es). No es una API: no existe ningún endpoint JSON que exponga
 * el % de volumen embalsado (la API de terceros que ya usa RioClient para el
 * río solo da la cota en metros para esta misma estación — comprobado en
 * vivo, ver docs/architecture-proposal.md). La página es HTML semántico y
 * estable (tablas con etiqueta/valor, no texto libre), por eso se usa un
 * parser HTML real (node-html-parser) en vez de expresiones regulares sobre
 * HTML — a diferencia de un CSV o un CAP-XML bien definidos, el HTML de
 * terceros puede anidar marcado de formas que una regex no cubre con
 * fiabilidad.
 */
export class SaihDueroEmbalseClient implements EmbalseProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 8000,
  ) {}

  async fetchEmbalse(stationCode: string): Promise<EmbalseSnapshot> {
    return withExternalRequestMetrics(METRIC_SOURCE, () => this.doFetchEmbalse(stationCode));
  }

  private async doFetchEmbalse(stationCode: string): Promise<EmbalseSnapshot> {
    const url = `${this.baseUrl}/ficha-risr?r=${encodeURIComponent(stationCode)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new UpstreamError(
          `SAIH Duero respondió ${res.status} para ${stationCode}`,
          'EMBALSE_ERROR',
        );
      }
      const html = await res.text();
      return this.parseHtml(html, stationCode, url);
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new UpstreamError(
          `Timeout al consultar SAIH Duero (${stationCode})`,
          'EMBALSE_TIMEOUT',
        );
      }
      throw new UpstreamError(
        `Error de red al consultar SAIH Duero: ${(err as Error).message}`,
        'EMBALSE_NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Extrae los pares etiqueta/valor de las dos formas en que la ficha los
   * presenta: tarjetas (`<strong>ETIQUETA</strong><p class="text-muted">VALOR</p>`)
   * y la tabla "Datos en tiempo real" (`<td>ETIQUETA</td><td class="variable">VALOR</td>`).
   */
  private parseHtml(html: string, stationCode: string, url: string): EmbalseSnapshot {
    const root = parse(html);

    const cardValues = new Map<string, string>();
    for (const strong of root.querySelectorAll('strong')) {
      const label = strong.text.trim();
      const valueEl = strong.parentNode?.querySelector('p.text-muted');
      if (label && valueEl) cardValues.set(label, valueEl.text.trim());
    }

    const tableValues = new Map<string, string>();
    for (const row of root.querySelectorAll('table tbody tr')) {
      const cells = row.querySelectorAll('td');
      const label = cells[0]?.text.trim();
      const value = cells[1]?.text.trim();
      if (label && value !== undefined) tableValues.set(label, value);
    }

    const nombre = root.querySelector('h3')?.text.trim() || `Embalse ${stationCode}`;

    const actualizacionText = root
      .querySelectorAll('.card-subtitle')
      .map((el) => el.text.trim())
      .find((text) => text.toLowerCase().includes('actualización'));
    const ultimaActualizacion =
      actualizacionText?.replace(/^.*actualización:\s*/i, '').trim() || null;

    if (cardValues.size === 0 && tableValues.size === 0) {
      throw new UpstreamError(
        `La ficha de SAIH Duero para "${stationCode}" no tiene el formato esperado (¿código de estación inexistente, o cambió el HTML de la fuente?).`,
        'EMBALSE_UNEXPECTED_SHAPE',
      );
    }

    return {
      stationCode,
      nombre,
      cauce: cardValues.get('Cauce') ?? '',
      municipio: cardValues.get('Municipio') ?? '',
      provincia: cardValues.get('Provincia') ?? '',
      capacidadMaximaHm3: parseSpanishNumber(cardValues.get('Capacidad máxima')),
      nivelMsnm: parseSpanishNumber(tableValues.get('Nivel')),
      nivelRelativoM: parseSpanishNumber(tableValues.get('Nivel relativo')),
      porcentajeLlenado: parseSpanishNumber(tableValues.get('Porcentaje de volumen embalsado')),
      volumenEmbalsadoHm3: parseSpanishNumber(tableValues.get('Volumen embalsado')),
      caudalVertidoM3s: parseSpanishNumber(tableValues.get('Caudal vertido')),
      ultimaActualizacion,
      source: `SAIH del Duero — Confederación Hidrográfica del Duero (${url})`,
    };
  }
}

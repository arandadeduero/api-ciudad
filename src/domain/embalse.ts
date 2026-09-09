/**
 * Snapshot de un embalse del SAIH del Duero (ver docs/architecture-proposal.md
 * §2.2b — extensión del módulo /rio, misma cuenca). No hay API JSON para
 * estos datos: se extraen de la ficha HTML pública de saihduero.es (única
 * fuente de la que se puede obtener el % de volumen embalsado — la API de
 * terceros que ya usamos para el río solo expone la cota en metros).
 */
export interface EmbalseSnapshot {
  stationCode: string;
  nombre: string;
  cauce: string;
  municipio: string;
  provincia: string;
  capacidadMaximaHm3: number | null;
  nivelMsnm: number | null;
  nivelRelativoM: number | null;
  porcentajeLlenado: number | null;
  volumenEmbalsadoHm3: number | null;
  caudalVertidoM3s: number | null;
  /**
   * Tal cual la publica la fuente ("DD/MM/YYYY HH:mm", hora de Madrid) — no
   * se convierte a ISO 8601 porque no declara si está en CET o CEST (UTC+1
   * o UTC+2 según la época del año) y forzar una de las dos podría desviarse
   * una hora en el cambio de horario.
   */
  ultimaActualizacion: string | null;
  source: string;
}

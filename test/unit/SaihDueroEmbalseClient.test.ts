import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaihDueroEmbalseClient } from '../../src/clients/SaihDueroEmbalseClient.js';
import { UpstreamError } from '../../src/errors/AppError.js';

/**
 * Fragmento sintético que reproduce la estructura real de
 * saihduero.es/ficha-risr (comprobada en vivo, 2026-09-09): tarjetas
 * <strong>etiqueta</strong><p class="text-muted">valor</p> para los datos
 * estáticos, y una tabla <td>etiqueta</td><td class="variable">valor</td>
 * para "Datos en tiempo real". No es un volcado completo de la página real
 * (sería frágil e innecesariamente grande) — solo lo mínimo que ejercita el
 * parser, incluyendo los casos límite ya encontrados en vivo: valores con
 * unidad pegada ("54,4 hm3") y valores "n/d".
 */
function fakeHtml(): string {
  return `<!doctype html><html><body>
    <h3>Embalse de Linares del Arroyo</h3>
    <div class="card"><div class="card-block">
      <h4>Datos geográficos</h4>
      <div class="row">
        <div class="col-md-3"><strong>Cauce</strong><br><p class="text-muted">Riaza</p></div>
        <div class="col-md-3"><strong>Municipio</strong><br><p class="text-muted">Maderuelo</p></div>
        <div class="col-md-3"><strong>Provincia</strong><br><p class="text-muted">Segovia</p></div>
      </div>
    </div></div>
    <div class="card"><div class="card-block">
      <h4>Datos de la estación</h4>
      <div class="row">
        <div class="col-md-3"><strong>Capacidad máxima</strong><br><p class="text-muted">54,4 <span class="text-muted">hm3</span></p></div>
      </div>
    </div></div>
    <div class="card"><div class="card-block">
      <h4>Datos en tiempo real</h4>
      <h6 class="card-subtitle">Última actualización: 09/09/2026 17:10</h6>
      <table><tbody>
        <tr><td>Nivel</td><td class="variable">907,67 <span class="text-muted">m.s.n.m</span></td></tr>
        <tr><td>Porcentaje de volumen embalsado</td><td class="variable">44,6 <span class="text-muted">%</span></td></tr>
        <tr><td>Volumen embalsado</td><td class="variable">24,25 <span class="text-muted">hm3</span></td></tr>
        <tr><td>Caudal entrante</td><td class="variable">n/d</td></tr>
      </tbody></table>
    </div></div>
  </body></html>`;
}

describe('SaihDueroEmbalseClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parsea tarjetas y tabla reales, con unidad pegada al número y valores n/d', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(fakeHtml(), { status: 200 })));

    const client = new SaihDueroEmbalseClient('https://www.saihduero.es');
    const result = await client.fetchEmbalse('EM511');

    expect(result.nombre).toBe('Embalse de Linares del Arroyo');
    expect(result.cauce).toBe('Riaza');
    expect(result.municipio).toBe('Maderuelo');
    expect(result.provincia).toBe('Segovia');
    // Caso que rompió la primera versión del parser: la unidad va pegada al
    // número ("54,4 hm3"), no en una celda aparte.
    expect(result.capacidadMaximaHm3).toBe(54.4);
    expect(result.nivelMsnm).toBe(907.67);
    expect(result.porcentajeLlenado).toBe(44.6);
    expect(result.volumenEmbalsadoHm3).toBe(24.25);
    // "n/d" es un campo real sin dato, no un error de parseo.
    expect(result.caudalVertidoM3s).toBeNull();
    expect(result.ultimaActualizacion).toBe('09/09/2026 17:10');
  });

  it('lanza UpstreamError si la fuente responde con error HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    const client = new SaihDueroEmbalseClient('https://www.saihduero.es');
    await expect(client.fetchEmbalse('EM511')).rejects.toBeInstanceOf(UpstreamError);
  });

  it('lanza UpstreamError si el HTML no tiene el formato esperado (sin tarjetas ni tabla)', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('<html><body>página vacía</body></html>', { status: 200 })),
    );
    const client = new SaihDueroEmbalseClient('https://www.saihduero.es');
    await expect(client.fetchEmbalse('EM999')).rejects.toBeInstanceOf(UpstreamError);
  });
});

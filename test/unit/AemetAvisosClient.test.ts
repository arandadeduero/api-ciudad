import { afterEach, describe, expect, it, vi } from 'vitest';
import { AemetAvisosClient } from '../../src/clients/AemetAvisosClient.js';
import { UpstreamError } from '../../src/errors/AppError.js';

const BLOCK_SIZE = 512;

function buildTar(entries: { name: string; content: string }[]): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    const header = new Uint8Array(BLOCK_SIZE);
    header.set(new TextEncoder().encode(entry.name), 0);
    const contentBytes = new TextEncoder().encode(entry.content);
    header.set(new TextEncoder().encode(contentBytes.length.toString(8).padStart(11, '0')), 124);
    header[156] = '0'.charCodeAt(0);
    blocks.push(header);
    const contentBlock = new Uint8Array(Math.ceil(contentBytes.length / BLOCK_SIZE) * BLOCK_SIZE);
    contentBlock.set(contentBytes, 0);
    blocks.push(contentBlock);
  }
  blocks.push(new Uint8Array(BLOCK_SIZE));
  const total = blocks.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of blocks) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

describe('AemetAvisosClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lanza UpstreamError (AVISOS_NOT_CONFIGURED) sin hacer ninguna llamada de red si falta la api_key', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const client = new AemetAvisosClient('https://opendata.aemet.es/opendata/api', '');
    await expect(client.fetchAvisos('67')).rejects.toMatchObject({ code: 'AVISOS_NOT_CONFIGURED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sigue el patrón en dos pasos: pide la URL de datos, luego descarga y extrae el TAR', async () => {
    const tar = buildTar([{ name: 'aviso.xml', content: '<alert>contenido</alert>' }]);

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            estado: 200,
            descripcion: 'exito',
            datos: 'https://example.com/datos.tar',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(tar, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = new AemetAvisosClient('https://opendata.aemet.es/opendata/api', 'test-key');
    const files = await client.fetchAvisos('67');

    expect(files).toEqual(['<alert>contenido</alert>']);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [firstUrl, firstOpts] = fetchSpy.mock.calls[0]!;
    expect(String(firstUrl)).toContain('/avisos_cap/ultimoelaborado/area/67');
    expect(firstOpts.headers).toEqual({ api_key: 'test-key' });
    expect(fetchSpy.mock.calls[1]![0]).toBe('https://example.com/datos.tar');
  });

  it('lanza UpstreamError si el primer paso no trae "datos"', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ estado: 404, descripcion: 'sin datos' }), { status: 200 }),
        ),
    );
    const client = new AemetAvisosClient('https://opendata.aemet.es/opendata/api', 'test-key');
    await expect(client.fetchAvisos('67')).rejects.toBeInstanceOf(UpstreamError);
  });

  it('lanza UpstreamError si el primer paso responde con error HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    const client = new AemetAvisosClient('https://opendata.aemet.es/opendata/api', 'bad-key');
    await expect(client.fetchAvisos('67')).rejects.toBeInstanceOf(UpstreamError);
  });
});

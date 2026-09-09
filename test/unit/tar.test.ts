import { describe, expect, it } from 'vitest';
import { readTarEntries } from '../../src/utils/tar.js';

const BLOCK_SIZE = 512;

/** Construye un TAR mínimo (sin checksum válido — este lector no lo comprueba, igual que el TAR real de AEMET que sí lo trae bien formado). */
function buildTar(entries: { name: string; content: string }[]): Uint8Array {
  const blocks: Uint8Array[] = [];

  for (const entry of entries) {
    const header = new Uint8Array(BLOCK_SIZE);
    const nameBytes = new TextEncoder().encode(entry.name);
    header.set(nameBytes, 0);

    const contentBytes = new TextEncoder().encode(entry.content);
    const sizeOctal = contentBytes.length.toString(8).padStart(11, '0');
    header.set(new TextEncoder().encode(sizeOctal), 124);
    header[156] = '0'.charCodeAt(0); // typeflag: fichero regular

    blocks.push(header);

    const paddedSize = Math.ceil(contentBytes.length / BLOCK_SIZE) * BLOCK_SIZE;
    const contentBlock = new Uint8Array(paddedSize);
    contentBlock.set(contentBytes, 0);
    blocks.push(contentBlock);
  }

  blocks.push(new Uint8Array(BLOCK_SIZE)); // bloque final de ceros (fin de archivo)

  const total = blocks.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const block of blocks) {
    result.set(block, offset);
    offset += block.length;
  }
  return result;
}

describe('readTarEntries', () => {
  it('lee una entrada cuyo contenido es exactamente un múltiplo de 512 bytes', () => {
    const content = 'x'.repeat(512);
    const tar = buildTar([{ name: 'exacto.txt', content }]);
    const entries = readTarEntries(tar);
    expect(entries).toHaveLength(1);
    expect(new TextDecoder().decode(entries[0]!.content)).toBe(content);
  });

  it('lee varias entradas con contenido no alineado a 512 bytes (relleno/padding)', () => {
    const tar = buildTar([
      { name: 'uno.xml', content: '<a>contenido corto</a>' },
      { name: 'dos.xml', content: '<b>' + 'y'.repeat(1000) + '</b>' },
    ]);
    const entries = readTarEntries(tar);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.name).toBe('uno.xml');
    expect(new TextDecoder().decode(entries[0]!.content)).toBe('<a>contenido corto</a>');
    expect(entries[1]!.name).toBe('dos.xml');
    expect(new TextDecoder().decode(entries[1]!.content)).toBe('<b>' + 'y'.repeat(1000) + '</b>');
  });

  it('devuelve un array vacío para un TAR vacío (solo bloques de fin)', () => {
    expect(readTarEntries(new Uint8Array(BLOCK_SIZE * 2))).toEqual([]);
  });

  it('devuelve un array vacío para un buffer vacío', () => {
    expect(readTarEntries(new Uint8Array(0))).toEqual([]);
  });
});

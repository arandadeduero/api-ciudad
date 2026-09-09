/**
 * Lector TAR mínimo, solo lectura, formato POSIX/ustar (RFC completa en
 * POSIX.1-2001). No es un ZIP: se comprobó en vivo que el archivo que
 * devuelve AEMET OpenData para /avisos_cap (pese a llamarse "*.tar.gz" en
 * la cabecera `Content-Disposition`) es un TAR sin comprimir — de ahí que
 * no baste con `fflate` (ya usado para el ZIP de GTFS), que descomprime
 * pero no lee TAR.
 *
 * Solo cubre lo que necesitamos: enumerar entradas de fichero regular y su
 * contenido. Nada de symlinks, directorios, ni escritura — mismo criterio
 * que la elección de `fflate` para GTFS: sin tocar el filesystem, todo en
 * memoria.
 */

const BLOCK_SIZE = 512;
const NAME_OFFSET = 0;
const NAME_LENGTH = 100;
const SIZE_OFFSET = 124;
const SIZE_LENGTH = 12;
const TYPEFLAG_OFFSET = 156;
const REGULAR_FILE_TYPEFLAGS = new Set(['0', '\0']);

export interface TarEntry {
  name: string;
  content: Uint8Array;
}

function readNullTerminatedString(block: Uint8Array, offset: number, length: number): string {
  const bytes = block.subarray(offset, offset + length);
  const nullIndex = bytes.indexOf(0);
  const trimmed = nullIndex === -1 ? bytes : bytes.subarray(0, nullIndex);
  return new TextDecoder('ascii').decode(trimmed).trim();
}

function isZeroBlock(block: Uint8Array): boolean {
  return block.every((byte) => byte === 0);
}

/** Enumera las entradas de fichero regular de un TAR sin comprimir. */
export function readTarEntries(buffer: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;

  while (offset + BLOCK_SIZE <= buffer.length) {
    const header = buffer.subarray(offset, offset + BLOCK_SIZE);
    if (isZeroBlock(header)) break; // fin de archivo (dos bloques cero; con uno basta para parar)

    const name = readNullTerminatedString(header, NAME_OFFSET, NAME_LENGTH);
    const sizeText = readNullTerminatedString(header, SIZE_OFFSET, SIZE_LENGTH);
    const size = sizeText ? parseInt(sizeText, 8) : 0;
    const typeflag = String.fromCharCode(header[TYPEFLAG_OFFSET] ?? 0);

    const contentStart = offset + BLOCK_SIZE;
    if (name && REGULAR_FILE_TYPEFLAGS.has(typeflag) && Number.isFinite(size) && size >= 0) {
      entries.push({ name, content: buffer.subarray(contentStart, contentStart + size) });
    }

    const paddedSize = Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
    offset = contentStart + paddedSize;
  }

  return entries;
}

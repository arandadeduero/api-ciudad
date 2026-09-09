import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../src/utils/csv.js';

describe('parseCsv', () => {
  it('parsea un CSV simple con cabecera', () => {
    const rows = parseCsv('a,b,c\n1,2,3\n4,5,6\n');
    expect(rows).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ]);
  });

  it('maneja campos entre comillas con comas dentro', () => {
    const rows = parseCsv('name,note\n"García, Juan",ok\n');
    expect(rows).toEqual([{ name: 'García, Juan', note: 'ok' }]);
  });

  it('maneja comillas escapadas dentro de un campo citado', () => {
    const rows = parseCsv('name\n"dijo ""hola"""\n');
    expect(rows).toEqual([{ name: 'dijo "hola"' }]);
  });

  it('maneja la última línea sin salto final', () => {
    const rows = parseCsv('a,b\n1,2');
    expect(rows).toEqual([{ a: '1', b: '2' }]);
  });

  it('recorta espacios en los valores', () => {
    const rows = parseCsv('a,b\n 1 , 2 \n');
    expect(rows).toEqual([{ a: '1', b: '2' }]);
  });

  it('devuelve un array vacío para texto vacío', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

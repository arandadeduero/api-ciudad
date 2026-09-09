import { describe, expect, it } from 'vitest';
import { toCentroEducativo } from '../../src/adapters/educacionAdapter.js';
import { UpstreamError } from '../../src/errors/AppError.js';

const centerOfTown = { latitude: 41.6701895, longitude: -3.6885626 };

function rawCentro(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    codigo: '09000239',
    denominacion_especifica: 'CLARET',
    denominacion_generica: 'CENTRO PRIVADO DE EDUCACION INFANTIL PRIMARIA Y SECUNDARIA',
    denominacion_generica_breve: 'Colegio',
    naturaleza: 'PRIVADO',
    via: 'AVENIDA',
    nombre_de_la_via: 'PADRE CLARET',
    numero: 1,
    c_postal: 9400,
    telefono: 947511954,
    correo_electronico: '09000239@educa.jcyl.es',
    web: 'http://www.claretaranda.net/',
    coord_latitud: 41.66765,
    coord_longitud: -3.68537,
    jornada_continua: 'N',
    comedor: 'S',
    transporte: 'N',
    ...overrides,
  };
}

describe('educacionAdapter', () => {
  it('mapea un registro real a CentroEducativo, con código postal a 5 dígitos y booleanos S/N', () => {
    const centro = toCentroEducativo(rawCentro(), centerOfTown);
    expect(centro.nombre).toBe('CLARET');
    expect(centro.codigoPostal).toBe('09400');
    expect(centro.telefono).toBe('947511954');
    expect(centro.comedor).toBe(true);
    expect(centro.jornadaContinua).toBe(false);
    expect(centro.location).toEqual({ latitude: 41.66765, longitude: -3.68537 });
  });

  it('declara location null cuando la coordenada del dataset está muy lejos del municipio (dato real: CINCO SENTIDOS)', () => {
    // Caso real encontrado en vivo (2026-09-09): un registro con dirección
    // "Carretera de Palencia" en Aranda, pero coordenadas ~67km al norte,
    // cerca de la ciudad de Palencia — error de geocodificación en el
    // propio dataset de JCyL, no algo que este adapter deba "corregir".
    const centro = toCentroEducativo(
      rawCentro({
        denominacion_especifica: 'CINCO SENTIDOS',
        coord_latitud: 42.34089,
        coord_longitud: -3.69976,
      }),
      centerOfTown,
    );
    expect(centro.location).toBeNull();
  });

  it('declara location null si el dataset no trae coordenadas', () => {
    const centro = toCentroEducativo(
      rawCentro({ coord_latitud: null, coord_longitud: null }),
      centerOfTown,
    );
    expect(centro.location).toBeNull();
  });

  it('acepta un centro en el límite del radio razonable (dentro del municipio, no en el casco urbano)', () => {
    // ~6km al norte del centro, todavía dentro de un municipio extenso — no debe descartarse.
    const centro = toCentroEducativo(
      rawCentro({
        coord_latitud: centerOfTown.latitude + 0.054,
        coord_longitud: centerOfTown.longitude,
      }),
      centerOfTown,
    );
    expect(centro.location).not.toBeNull();
  });

  it('lanza UpstreamError si el registro no tiene el formato esperado', () => {
    expect(() => toCentroEducativo({ codigo: '1' }, centerOfTown)).toThrow(UpstreamError);
  });
});

import { describe, expect, it } from 'vitest';
import { parseAvisoXml, buildAvisosSnapshot } from '../../src/adapters/avisosAdapter.js';
import { UpstreamError } from '../../src/errors/AppError.js';

/**
 * Reproduce la estructura real de un CAP-XML de AEMET (comprobado en vivo,
 * 2026-09-09): dos <info> (es-ES/en-GB), varias <area> con <geocode>, y el
 * nivel dentro de <parameter valueName="AEMET-Meteoalerta nivel">. No es un
 * volcado completo (los polígonos reales tienen cientos de puntos).
 */
function capXml(opts: { nivel: string; zonaCodigo: string; otraZonaCodigo: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>test</identifier>
  <info>
    <language>es-ES</language>
    <event>Aviso de vientos de nivel ${opts.nivel}</event>
    <severity>Minor</severity>
    <headline>Aviso de vientos de nivel ${opts.nivel}. CCAA</headline>
    <effective>2026-09-08T23:50:01+02:00</effective>
    <onset>2026-09-11T00:00:00+02:00</onset>
    <expires>2026-09-11T23:59:59+02:00</expires>
    <parameter>
      <valueName>AEMET-Meteoalerta nivel</valueName>
      <value>${opts.nivel}</value>
    </parameter>
    <area>
      <areaDesc>Otra zona cualquiera</areaDesc>
      <polygon>0,0 1,1 1,0</polygon>
      <geocode><valueName>AEMET-Meteoalerta zona</valueName><value>${opts.otraZonaCodigo}</value></geocode>
    </area>
    <area>
      <areaDesc>Meseta de Burgos</areaDesc>
      <polygon>0,0 1,1 1,0</polygon>
      <geocode><valueName>AEMET-Meteoalerta zona</valueName><value>${opts.zonaCodigo}</value></geocode>
    </area>
  </info>
  <info>
    <language>en-GB</language>
    <event>Wind warning</event>
    <severity>Minor</severity>
    <headline>Wind warning</headline>
    <effective>2026-09-08T23:50:01+02:00</effective>
    <expires>2026-09-11T23:59:59+02:00</expires>
    <area>
      <areaDesc>Some other zone</areaDesc>
      <geocode><valueName>AEMET-Meteoalerta zona</valueName><value>${opts.zonaCodigo}</value></geocode>
    </area>
  </info>
</alert>`;
}

describe('avisosAdapter', () => {
  it('extrae el aviso del bloque es-ES que contiene la zona buscada, ignorando en-GB', () => {
    const xml = capXml({ nivel: 'verde', zonaCodigo: '670904', otraZonaCodigo: '670902' });
    const aviso = parseAvisoXml(xml, '670904');
    expect(aviso).not.toBeNull();
    expect(aviso!.fenomeno).toBe('Aviso de vientos de nivel verde');
    expect(aviso!.nivel).toBe('verde');
    expect(aviso!.severity).toBe('Minor');
    expect(aviso!.onset).toBe('2026-09-11T00:00:00+02:00');
  });

  it('devuelve un nivel distinto de verde tal cual viene (amarillo/naranja/rojo)', () => {
    const xml = capXml({ nivel: 'amarillo', zonaCodigo: '670904', otraZonaCodigo: '670902' });
    const aviso = parseAvisoXml(xml, '670904');
    expect(aviso!.nivel).toBe('amarillo');
  });

  it('devuelve null si la zona buscada no aparece en ningún <area>', () => {
    const xml = capXml({ nivel: 'verde', zonaCodigo: '670904', otraZonaCodigo: '670902' });
    const aviso = parseAvisoXml(xml, '999999');
    expect(aviso).toBeNull();
  });

  it('lanza UpstreamError si el XML no tiene forma de CAP alert', () => {
    expect(() => parseAvisoXml('<no-es-cap/>', '670904')).toThrow(UpstreamError);
  });

  it('lanza UpstreamError si el XML está mal formado', () => {
    expect(() => parseAvisoXml('<alert><info>', '670904')).toThrow(UpstreamError);
  });

  it('buildAvisosSnapshot agrega varios ficheros y marca hayAvisosActivos si alguno no es verde', () => {
    const verde = capXml({ nivel: 'verde', zonaCodigo: '670904', otraZonaCodigo: '670902' });
    const amarillo = capXml({ nivel: 'amarillo', zonaCodigo: '670904', otraZonaCodigo: '670902' });

    const allGreen = buildAvisosSnapshot(
      [verde, verde],
      { codigo: '670904', nombre: 'Meseta de Burgos' },
      'src',
    );
    expect(allGreen.hayAvisosActivos).toBe(false);
    expect(allGreen.avisos).toHaveLength(2);

    const withYellow = buildAvisosSnapshot(
      [verde, amarillo],
      { codigo: '670904', nombre: 'Meseta de Burgos' },
      'src',
    );
    expect(withYellow.hayAvisosActivos).toBe(true);
  });

  it('buildAvisosSnapshot ignora los ficheros donde la zona no aparece, sin lanzar', () => {
    const withoutZona = capXml({ nivel: 'verde', zonaCodigo: '670902', otraZonaCodigo: '670903' });
    const snapshot = buildAvisosSnapshot(
      [withoutZona],
      { codigo: '670904', nombre: 'Meseta de Burgos' },
      'src',
    );
    expect(snapshot.avisos).toHaveLength(0);
    expect(snapshot.hayAvisosActivos).toBe(false);
  });
});

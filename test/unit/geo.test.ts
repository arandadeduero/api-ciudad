import { describe, expect, it } from 'vitest';
import { distanceMeters } from '../../src/utils/geo.js';

describe('distanceMeters', () => {
  it('la distancia de un punto a sí mismo es 0', () => {
    expect(
      distanceMeters({ latitude: 41.67, longitude: -3.69 }, { latitude: 41.67, longitude: -3.69 }),
    ).toBe(0);
  });

  it('calcula una distancia razonable entre dos puntos conocidos de Aranda de Duero', () => {
    // Plaza Mayor -> Sol de las Moreras, ambos geocodificados en este proyecto.
    const d = distanceMeters(
      { latitude: 41.6701895, longitude: -3.6885626 },
      { latitude: 41.6698519, longitude: -3.6843645 },
    );
    // Son ~350m en línea recta; margen amplio para no acoplar el test a la fórmula exacta.
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(400);
  });
});

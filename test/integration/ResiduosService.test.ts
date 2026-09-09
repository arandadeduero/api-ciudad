import { describe, expect, it } from 'vitest';
import { ResiduosService } from '../../src/services/ResiduosService.js';
import { ResiduosRepository } from '../../src/repositories/ResiduosRepository.js';
import { NotFoundError } from '../../src/errors/AppError.js';

const service = new ResiduosService(new ResiduosRepository());

describe('ResiduosService', () => {
  it('devuelve el horario del punto limpio', async () => {
    const puntoLimpio = await service.getPuntoLimpio();
    expect(puntoLimpio.direccion).toContain('La Aguilera');
  });

  it('lista los 9 tipos de contenedor', async () => {
    const contenedores = await service.listContenedores();
    expect(contenedores).toHaveLength(9);
  });

  it('devuelve el contenedor de vidrio con su horario de depósito', async () => {
    const vidrio = await service.getContenedor('vidrio');
    expect(vidrio.horarioDeposito).toMatchObject({ desde: '08:00', hasta: '23:00' });
  });

  it('lanza NotFoundError para un tipo inexistente', async () => {
    await expect(service.getContenedor('no-existe')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('devuelve el contacto de recogida de enseres (Valoriza)', async () => {
    const enseres = await service.getEnseres();
    expect(enseres.telefono).toBe('947506050');
  });

  it('devuelve el horario de recogida de cartón comercial', async () => {
    const carton = await service.getComercioCarton();
    expect(carton.horario).toMatchObject({ desde: '13:00', hasta: '14:00' });
  });
});

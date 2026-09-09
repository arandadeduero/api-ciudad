import { describe, expect, it } from 'vitest';
import { ParkingService } from '../../src/services/ParkingService.js';
import { ParkingRepository } from '../../src/repositories/ParkingRepository.js';
import { NotFoundError } from '../../src/errors/AppError.js';

const service = new ParkingService(new ParkingRepository());

describe('ParkingService', () => {
  it('lista los aparcamientos públicos reales', async () => {
    const parkings = await service.listPublicParkings();
    expect(parkings.length).toBeGreaterThan(0);
    expect(parkings[0]).toMatchObject({ availabilityStatus: 'NOT_AVAILABLE' });
  });

  it('devuelve un aparcamiento por id', async () => {
    const parking = await service.getPublicParking('sol-de-las-moreras');
    expect(parking.name).toBe('Sol de las Moreras');
  });

  it('lanza NotFoundError para un id inexistente', async () => {
    await expect(service.getPublicParking('no-existe')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('devuelve la información completa del ORA con 6 distritos (A-F)', async () => {
    const ora = await service.getOraInfo();
    expect(ora.districts).toHaveLength(6);
    expect(ora.districts.map((d) => d.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(ora.duration.nonResidentsDefault.maxMinutes).toBe(120);
  });

  it('devuelve un distrito ORA concreto (sin distinguir mayúsculas)', async () => {
    const district = await service.getOraDistrict('a');
    expect(district.streets).toContain('Calle Miranda do Douro');
  });

  it('lanza NotFoundError para un distrito inexistente', async () => {
    await expect(service.getOraDistrict('Z')).rejects.toBeInstanceOf(NotFoundError);
  });
});

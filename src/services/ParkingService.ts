import type { ParkingRepository } from '../repositories/ParkingRepository.js';
import type { OraDistrict, OraInfo, PublicParking } from '../domain/parking.js';
import { NotFoundError } from '../errors/AppError.js';

export class ParkingService {
  constructor(private readonly repo: ParkingRepository) {}

  async listPublicParkings(): Promise<PublicParking[]> {
    const { publicParkings } = await this.repo.get();
    return publicParkings;
  }

  async getPublicParking(id: string): Promise<PublicParking> {
    const { publicParkings } = await this.repo.get();
    const parking = publicParkings.find((p) => p.id === id);
    if (!parking) {
      throw new NotFoundError(`No existe ningún aparcamiento con id "${id}".`);
    }
    return parking;
  }

  async getOraInfo(): Promise<OraInfo> {
    const { ora } = await this.repo.get();
    return ora;
  }

  async getOraDistrict(id: string): Promise<OraDistrict> {
    const { ora } = await this.repo.get();
    const district = ora.districts.find((d) => d.id.toUpperCase() === id.toUpperCase());
    if (!district) {
      throw new NotFoundError(
        `No existe el distrito ORA "${id}". Distritos disponibles: ${ora.districts.map((d) => d.id).join(', ')}.`,
      );
    }
    return district;
  }
}

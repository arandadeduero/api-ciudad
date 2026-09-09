import type { ResiduosRepository } from '../repositories/ResiduosRepository.js';
import type { Contenedor } from '../domain/residuos.js';
import { NotFoundError } from '../errors/AppError.js';

export class ResiduosService {
  constructor(private readonly repo: ResiduosRepository) {}

  async getPuntoLimpio() {
    return (await this.repo.get()).puntoLimpio;
  }

  async listContenedores(): Promise<Contenedor[]> {
    return (await this.repo.get()).contenedores;
  }

  async getContenedor(tipo: string): Promise<Contenedor> {
    const { contenedores } = await this.repo.get();
    const contenedor = contenedores.find((c) => c.tipo === tipo);
    if (!contenedor) {
      throw new NotFoundError(
        `No existe el tipo de contenedor "${tipo}". Tipos disponibles: ${contenedores.map((c) => c.tipo).join(', ')}.`,
      );
    }
    return contenedor;
  }

  async getEnseres() {
    return (await this.repo.get()).enseres;
  }

  async getComercioCarton() {
    return (await this.repo.get()).comercioCarton;
  }

  async getAtencionCiudadana() {
    return (await this.repo.get()).atencionCiudadana;
  }
}

export interface Biblioteca {
  codigo: string;
  nombre: string;
  tipo: string;
  direccion: string;
  localidad: string;
  provincia: string;
  location: { latitude: number; longitude: number } | null;
  /** Ficha oficial en bibliotecas.jcyl.es. El dataset no incluye horario de apertura. */
  enlace: string | null;
}

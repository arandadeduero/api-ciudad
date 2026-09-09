export interface CentroEducativo {
  codigo: string;
  nombre: string;
  tipo: string;
  tipoBreve: string;
  naturaleza: 'PUBLICO' | 'PRIVADO' | string;
  direccion: string;
  codigoPostal: string | null;
  telefono: string | null;
  correoElectronico: string | null;
  web: string | null;
  /**
   * null si el dataset de origen trae una coordenada fuera de un radio
   * razonable del municipio (ver adapters/educacionAdapter.ts) — nunca se
   * inventa ni se "corrige" una coordenada, se declara no disponible.
   */
  location: { latitude: number; longitude: number } | null;
  jornadaContinua: boolean;
  comedor: boolean;
  transporteEscolar: boolean;
}

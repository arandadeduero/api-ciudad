export type NivelAviso = 'verde' | 'amarillo' | 'naranja' | 'rojo';

export interface AvisoFenomeno {
  fenomeno: string;
  nivel: NivelAviso | string;
  severity: string;
  headline: string;
  effective: string;
  onset: string | null;
  expires: string;
}

export interface AvisosSnapshot {
  zona: string;
  zonaCodigo: string;
  avisos: AvisoFenomeno[];
  hayAvisosActivos: boolean;
  source: string;
}

/**
 * Modelo de dominio del módulo de farmacias. Estable de cara a la API
 * pública aunque cambie el origen de los datos (hoy ficheros locales
 * derivados de un PDF real, ver data/farmacias-guardia-2026.json).
 */
export interface Pharmacy {
  id: number;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  zone: string | null;
  phone: string;
  location: { latitude: number; longitude: number };
}

export interface Holiday {
  date: string;
  name: string;
  scope: 'nacional' | 'autonomico';
}

export interface GuardEntry {
  date: string;
  pharmacy: Pharmacy;
  holiday: Holiday | null;
  /** true si esta fecha está en la lista de baja confianza documentada en el caveat de la fuente. */
  lowConfidence: boolean;
}

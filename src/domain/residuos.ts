export interface PuntoLimpio {
  operador: string;
  direccion: string;
  usuarios: string;
  horario: {
    lunesAViernes: { periodo: string; desde: string; hasta: string }[];
    sabado: { periodo: string; desde: string; hasta: string }[];
    excepciones: string;
  };
}

export interface Contenedor {
  tipo: string;
  color: string | null;
  descripcion: string;
  instrucciones: string | null;
  horarioDeposito: { desde: string; hasta: string } | null;
}

export interface Enseres {
  descripcion: string;
  metodo: string;
  operador: string;
  telefono: string;
}

export interface ComercioCarton {
  descripcion: string;
  horario: { diasSemana: string; desde: string; hasta: string };
  instrucciones: string;
  sancionPorIncumplimiento: string;
  fuente: string;
}

export interface AtencionCiudadana {
  telefono: string;
  horario: { desde: string; hasta: string };
  sedeElectronica: string;
  correo: string;
  oficinas: { nombre: string; direccion: string }[];
}

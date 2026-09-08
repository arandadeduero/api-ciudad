/**
 * Error tipado de aplicación. Cualquier error de negocio que deba traducirse
 * a una respuesta HTTP concreta debe lanzarse como AppError (o una subclase),
 * nunca como Error genérico — así el error handler central nunca necesita
 * adivinar el status code ni filtrar detalles internos.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(400, code, message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code = 'NOT_FOUND') {
    super(404, code, message);
    this.name = 'NotFoundError';
  }
}

export class UpstreamError extends AppError {
  constructor(message: string, code = 'UPSTREAM_ERROR') {
    super(502, code, message);
    this.name = 'UpstreamError';
  }
}

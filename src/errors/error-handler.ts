import type { FastifyInstance, FastifyError } from 'fastify';
import { AppError } from './AppError.js';

/**
 * Handler de errores centralizado. Traduce cualquier excepción —tipada o
 * no— al formato de error estable definido en docs/architecture-proposal.md:
 *
 *   { "error": { "code", "message", "requestId" } }
 *
 * Nunca se filtran stack traces ni detalles internos al cliente.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    const requestId = request.id;

    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, requestId },
      });
      return;
    }

    // Errores de validación de esquema de Fastify (querystring/params/body)
    if ('validation' in error && error.validation) {
      request.log.warn({ err: error }, 'Request validation failed');
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          requestId,
        },
      });
      return;
    }

    request.log.error({ err: error }, 'Unhandled error');

    const statusCode =
      'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;

    reply.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ha ocurrido un error inesperado.',
        requestId,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `No existe la ruta ${request.method} ${request.url}`,
        requestId: request.id,
      },
    });
  });
}

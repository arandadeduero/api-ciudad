import { UpstreamError } from '../errors/AppError.js';

const RETRYABLE_CODE_SUFFIXES = ['_TIMEOUT', '_NETWORK_ERROR'];

function isTransient(err: unknown): boolean {
  return err instanceof UpstreamError && RETRYABLE_CODE_SUFFIXES.some((s) => err.code.endsWith(s));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reintenta una vez una llamada a un proveedor externo, y solo si el fallo
 * es de los que ya se documentaban como transitorios antes de que hubiera
 * ningún reintento real (.claude/CLAUDE.md, lección "Third-party free APIs
 * fail transiently for real... retry once, and if it passes, it was
 * transient"): timeout o error de red (códigos `*_TIMEOUT`/`*_NETWORK_ERROR`
 * que todos los clientes de src/clients/ ya usan). Un fallo de negocio real
 * (4xx/5xx del proveedor, formato de respuesta inesperado, recurso
 * inexistente...) nunca se reintenta: repetirlo no lo arregla, solo añade
 * latencia y puede insistir contra un servicio que ya está devolviendo un
 * error correcto.
 */
export async function withSingleRetry<T>(
  attempt: () => Promise<T>,
  retryDelayMs = 200,
): Promise<T> {
  try {
    return await attempt();
  } catch (err) {
    if (!isTransient(err)) throw err;
    if (retryDelayMs > 0) await sleep(retryDelayMs);
    return attempt();
  }
}

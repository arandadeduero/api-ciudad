import { describe, expect, it, vi } from 'vitest';
import { withSingleRetry } from '../../src/utils/httpRetry.js';
import { UpstreamError } from '../../src/errors/AppError.js';

describe('withSingleRetry', () => {
  it('no reintenta si el primer intento tiene éxito', async () => {
    const attempt = vi.fn().mockResolvedValue('ok');
    await expect(withSingleRetry(attempt, 0)).resolves.toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('reintenta una vez tras un timeout y devuelve el resultado si el segundo intento tiene éxito', async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new UpstreamError('timeout', 'RIO_TIMEOUT'))
      .mockResolvedValueOnce('ok');
    await expect(withSingleRetry(attempt, 0)).resolves.toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('reintenta una vez tras un error de red', async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new UpstreamError('red caída', 'OPEN_METEO_NETWORK_ERROR'))
      .mockResolvedValueOnce('ok');
    await expect(withSingleRetry(attempt, 0)).resolves.toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('no reintenta un error de negocio (p. ej. HTTP no-ok o formato inesperado)', async () => {
    const err = new UpstreamError('JCyL respondió 500', 'JCYL_ERROR');
    const attempt = vi.fn().mockRejectedValue(err);
    await expect(withSingleRetry(attempt, 0)).rejects.toBe(err);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('no reintenta un error que no es UpstreamError', async () => {
    const err = new Error('boom');
    const attempt = vi.fn().mockRejectedValue(err);
    await expect(withSingleRetry(attempt, 0)).rejects.toBe(err);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('si el segundo intento también falla por timeout, propaga ese segundo error (solo un reintento)', async () => {
    const first = new UpstreamError('timeout 1', 'GTFS_TIMEOUT');
    const second = new UpstreamError('timeout 2', 'GTFS_TIMEOUT');
    const attempt = vi.fn().mockRejectedValueOnce(first).mockRejectedValueOnce(second);
    await expect(withSingleRetry(attempt, 0)).rejects.toBe(second);
    expect(attempt).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { InMemoryCache } from '../../src/cache/InMemoryCache.js';

describe('InMemoryCache', () => {
  it('devuelve undefined si la clave no existe', async () => {
    const cache = new InMemoryCache();
    await expect(cache.get('missing')).resolves.toBeUndefined();
  });

  it('guarda y recupera un valor dentro del TTL', async () => {
    const cache = new InMemoryCache();
    await cache.set('key', { foo: 'bar' }, 60);
    await expect(cache.get('key')).resolves.toEqual({ foo: 'bar' });
  });

  it('expira un valor pasado el TTL', async () => {
    vi.useFakeTimers();
    const cache = new InMemoryCache();
    await cache.set('key', 'value', 1);

    vi.advanceTimersByTime(1_001);

    await expect(cache.get('key')).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('getStale devuelve el valor aunque haya expirado', async () => {
    vi.useFakeTimers();
    const cache = new InMemoryCache();
    await cache.set('key', 'value', 1);

    vi.advanceTimersByTime(1_001);

    await expect(cache.get('key')).resolves.toBeUndefined();
    await expect(cache.getStale('key')).resolves.toBe('value');
    vi.useRealTimers();
  });

  it('delete elimina la entrada', async () => {
    const cache = new InMemoryCache();
    await cache.set('key', 'value', 60);
    await cache.delete('key');
    await expect(cache.get('key')).resolves.toBeUndefined();
    await expect(cache.getStale('key')).resolves.toBeUndefined();
  });

  it('clear vacía toda la cache', async () => {
    const cache = new InMemoryCache();
    await cache.set('a', 1, 60);
    await cache.set('b', 2, 60);
    await cache.clear();
    await expect(cache.get('a')).resolves.toBeUndefined();
    await expect(cache.get('b')).resolves.toBeUndefined();
  });
});

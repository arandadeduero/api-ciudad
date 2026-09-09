import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatomoService } from '../../src/services/MatomoService.js';

describe('MatomoService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('no hace ninguna llamada de red si está desactivado', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const service = new MatomoService({
      enabled: false,
      url: 'https://matomo.example',
      siteId: '1',
      token: '',
    });
    service.track({ path: '/api/v1/rio', actionName: 'GET /api/v1/rio' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envía un GET a matomo.php con los parámetros esperados cuando está activado', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const service = new MatomoService({
      enabled: true,
      url: 'https://matomo.example',
      siteId: '7',
      token: 'secret',
    });
    service.track({ path: '/api/v1/rio', actionName: 'GET /api/v1/rio' });

    // track() es fire-and-forget: esperamos un tick para que la promesa interna corra.
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const [firstCall] = fetchSpy.mock.calls;
    const calledUrl = new URL(firstCall![0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe('https://matomo.example/matomo.php');
    expect(calledUrl.searchParams.get('idsite')).toBe('7');
    expect(calledUrl.searchParams.get('rec')).toBe('1');
    expect(calledUrl.searchParams.get('url')).toBe('/api/v1/rio');
    expect(calledUrl.searchParams.get('action_name')).toBe('GET /api/v1/rio');
    expect(calledUrl.searchParams.get('token_auth')).toBe('secret');
  });

  it('nunca lanza si la llamada de red falla', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const service = new MatomoService({
      enabled: true,
      url: 'https://matomo.example',
      siteId: '1',
      token: '',
    });

    expect(() => service.track({ path: '/x', actionName: 'GET /x' })).not.toThrow();
  });
});

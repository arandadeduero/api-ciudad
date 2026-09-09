export interface MatomoConfig {
  enabled: boolean;
  url: string;
  siteId: string;
  token: string;
}

export interface MatomoTrackOptions {
  /** Ruta solicitada, usada como "URL" de la página vista en Matomo. */
  path: string;
  /** Nombre legible de la acción, p. ej. "GET /api/v1/rio/nivel". */
  actionName: string;
}

/**
 * Tracking de uso vía Matomo, **best-effort** (§4.4 de
 * docs/architecture-proposal.md): fire-and-forget, con timeout agresivo y
 * sin propagar nunca un error hacia la petición HTTP real. Un Matomo caído,
 * lento o mal configurado no debe afectar jamás a la disponibilidad de la
 * API — por eso `track()` no es `async` y nunca lanza.
 */
export class MatomoService {
  constructor(
    private readonly config: MatomoConfig,
    private readonly timeoutMs = 1500,
  ) {}

  track(options: MatomoTrackOptions): void {
    if (!this.config.enabled) return;

    void this.send(options).catch(() => {
      // Silenciado a propósito: un fallo de analítica no es un error de la API.
    });
  }

  private async send(options: MatomoTrackOptions): Promise<void> {
    const url = new URL(`${this.config.url.replace(/\/$/, '')}/matomo.php`);
    url.searchParams.set('idsite', this.config.siteId);
    url.searchParams.set('rec', '1');
    url.searchParams.set('apiv', '1');
    url.searchParams.set('url', options.path);
    url.searchParams.set('action_name', options.actionName);
    if (this.config.token) {
      url.searchParams.set('token_auth', this.config.token);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

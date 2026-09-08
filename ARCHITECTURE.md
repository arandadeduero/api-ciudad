# Arquitectura

Documento de referencia rápida sobre lo **ya implementado**. Para la
investigación de fuentes, el razonamiento completo y las decisiones
descartadas, ver el documento canónico:
[`docs/architecture-proposal.md`](docs/architecture-proposal.md).

## Capas

```text
Client (proveedor externo)
   ↓
Adapter (normaliza al modelo de dominio propio)
   ↓
Service (reglas de negocio, TTL, fallback)
   ↓
Cache (CacheService — memoria por defecto, Redis cuando haga falta)
   ↓
Controller / Route (validación con Zod/JSON Schema, mapeo HTTP)
   ↓
REST API /api/v1
```

En la Fase 1 no existe todavía ningún `Client`/`Adapter`/`Service` real
(no hay módulos de datos implementados) — lo que sí existe es la
infraestructura común que todos ellos usarán:

- `src/config/env.ts` — validación de variables de entorno con Zod, fail-fast.
- `src/errors/` — `AppError` tipado + error handler central (`{ error: { code, message, requestId } }`).
- `src/cache/` — `CacheService` (interfaz) + `InMemoryCache` (implementación activa).
- `src/plugins/security.ts` — Helmet, CORS, rate limiting.
- `src/plugins/openapi.ts` — OpenAPI 3 + Swagger UI en `/docs`.
- `src/routes/health.ts` — `/health`, `/health/live`, `/health/ready`, `/health/deep`.
- `src/app.ts` — fábrica de la instancia Fastify (testeable con `inject()`).
- `src/server.ts` — entrypoint HTTP con cierre ordenado (SIGINT/SIGTERM).

## Principios que sigue el código

1. **Ningún endpoint de datos inventa información.** Si una fuente no existe
   o no se ha decidido cómo tratarla, el módulo no se implementa (ver
   `docs/architecture-proposal.md` §6) — no se sustituye por datos
   ficticios salvo los fixtures explícitamente pedidos (`data/farmacias.json`,
   pendiente de fase 2).
2. **Fail fast en configuración**, nunca en tiempo de request.
3. **Errores tipados** (`AppError` y subclases) en toda la capa de servicio;
   el controller nunca construye la respuesta de error a mano.
4. **Cache y resiliencia son responsabilidad del Service**, nunca del
   Controller ni del Client — el Client solo sabe hablar con el proveedor.

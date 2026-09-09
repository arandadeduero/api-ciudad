# Guía de desarrollo

## Arrancar en local

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` usa `tsx watch` — recompila y reinicia en cada cambio. Carga
`.env` automáticamente si existe (`--env-file-if-exists`, nativo de Node
≥20.12) — necesario para probar `GET /api/v1/weather/avisos` en local con
una `AEMET_API_KEY` real; sin `.env`, el flag simplemente no hace nada.

## Calidad de código

```bash
npm run lint          # ESLint (flat config, typescript-eslint)
npm run lint:fix
npm run format        # Prettier
npm run format:check
npm run typecheck      # tsc --noEmit, sin build
```

## Tests

```bash
npm test               # vitest run (unit + e2e vía fastify.inject)
npm run test:watch
npm run test:coverage
```

Los tests E2E de `test/e2e/` usan `app.inject()` (sin abrir un socket real);
el `npm run smoke-test` en `scripts/smoke-test.mjs` es el único que golpea
HTTP real y se usa contra una instancia ya arrancada (local o Docker).

## Convenciones de código

- Módulos ES (`"type": "module"`), imports relativos con extensión `.js`
  (requisito de `moduleResolution: NodeNext` con TypeScript).
- Cualquier código de negocio que necesite fallar con un status HTTP
  concreto debe lanzar `AppError` (o subclase) de `src/errors/AppError.ts`,
  nunca `throw new Error(...)` a pelo.
- Los clientes a proveedores externos (fase 2+) van en `src/clients/`, los
  adapters que normalizan su respuesta en `src/adapters/` (ver
  `docs/architecture-proposal.md` §4.1) — no mezclar ambas responsabilidades
  en la misma clase.
- No usar `console.log`; usar el logger de Fastify (`request.log` /
  `app.log`), que ya está configurado en `src/app.ts` (pino, pretty en dev).

## Añadir un módulo de datos nuevo (a partir de la fase 2)

1. `src/clients/<Proveedor>Client.ts` — solo habla HTTP con el proveedor.
2. `src/adapters/<Proveedor>Adapter.ts` — traduce la respuesta nativa al
   modelo de dominio propio (schema Zod de validación incluido).
3. `src/services/<Dominio>Service.ts` — TTL, cache, fallback stale.
4. `src/routes/<dominio>.ts` — validación de params/query, schema OpenAPI,
   llamada al service.
5. Test unitario del adapter (mapeo), test de integración del service
   (cache hit/miss, fallback), test E2E de la ruta.

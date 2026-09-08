# API — endpoints implementados

La fuente de verdad siempre es `/docs` (Swagger UI) y `/docs/json` (spec
OpenAPI), generados desde el código. Este fichero es un resumen manual para
lectura rápida, y se actualiza en cada fase.

## Estado: Fase 1

| Método | Ruta            | Descripción                                                                                                    |
| ------ | --------------- | -------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`       | Estado general: `{ status, version, uptime }`                                                                  |
| GET    | `/health/live`  | Liveness probe                                                                                                 |
| GET    | `/health/ready` | Readiness probe (comprueba dependencias críticas — hoy solo cache)                                             |
| GET    | `/health/deep`  | Diagnóstico de cada fuente de datos; todas listadas como `not_implemented` hasta que se construyan en fases 2+ |
| GET    | `/docs`         | Swagger UI                                                                                                     |
| GET    | `/docs/json`    | Spec OpenAPI 3                                                                                                 |

Ningún endpoint de `/api/v1/*` existe todavía. Se irán añadiendo por fase
según `docs/architecture-proposal.md` §7, condicionados a las decisiones
pendientes en su §6.

## Formato de respuesta

Éxito:

```json
{ "data": {}, "meta": { "source": "...", "retrievedAt": "...", "cached": false } }
```

Error:

```json
{ "error": { "code": "INVALID_DATE", "message": "...", "requestId": "..." } }
```

(Los endpoints de `/health` no siguen el envoltorio `data`/`meta` por
convención estándar de health checks; sí siguen el formato de error común.)

# syntax=docker/dockerfile:1

# ─── Stage 1: dependencias de producción ───
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ─── Stage 2: build (TypeScript -> JS) ───
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ─── Stage 3: runtime mínimo ───
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S nodejs && adduser -S apiciudad -G nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Datasets estáticos reales que leen los repositorios (ver ARCHITECTURE.md);
# no son fixtures de desarrollo, la API los necesita en producción.
# --chown es necesario: GtfsRepository escribe su caché de disco en
# data/gtfs-urbano/ en tiempo de ejecución como usuario no root.
COPY --chown=apiciudad:nodejs data ./data

USER apiciudad

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Node maneja SIGTERM/SIGINT de forma nativa como PID 1 en `docker run`;
# el cierre ordenado real lo implementa src/server.ts (app.close()).
CMD ["node", "dist/server.js"]

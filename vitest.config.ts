import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Silencia el logging de Fastify/Pino durante los tests E2E — el ruido
    // no aporta nada a la salida de vitest y solo entorpece leerla.
    env: { LOG_LEVEL: 'silent' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
    },
  },
});

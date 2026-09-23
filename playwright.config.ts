import { defineConfig } from '@playwright/test';

// Testes end-to-end contra o ambiente de desenvolvimento já em execução (make dev).
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  // O servidor de dev compila cada página na primeira visita; uma nova tentativa absorve essa lentidão inicial
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.APP_URL ?? 'http://localhost:4321',
    viewport: { width: 1440, height: 1024 },
    trace: 'retain-on-failure',
  },
});

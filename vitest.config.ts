import { defineConfig } from 'vitest/config';

// Testes unitários ficam junto do código (src/**/*.test.ts); os e2e (tests/e2e) rodam com Playwright.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});

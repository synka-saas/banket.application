import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [preact()],
  security: {
    // Rejeita POST/PUT/PATCH/DELETE de formulários vindos de outra origem (proteção CSRF)
    checkOrigin: true,
  },
  vite: {
    server: {
      watch: {
        usePolling: true,
      },
    },
  },
});

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
    // Domínios servidos atrás do Nginx: confia em X-Forwarded-Proto/Host/For só para eles.
    // Sem isso o app vê "http://" (proxy → container) e o checkOrigin rejeita o POST vindo de "https://".
    allowedDomains: [
      { protocol: 'https', hostname: 'app.banket.com.br' },
      { hostname: 'localhost' },
    ],
  },
  vite: {
    server: {
      watch: {
        usePolling: true,
      },
    },
  },
});

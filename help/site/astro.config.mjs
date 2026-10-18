// Central de Ajuda do Yosp — site estático servido em platform.yosp.app/ajuda/.
// O conteúdo vem de ../support (fonte única); ver help/DEPLOY.md.
import { defineConfig } from 'astro/config';
import remarkHelp from './src/plugins/remark-help.mjs';
import rehypeHelp from './src/plugins/rehype-help.mjs';

export default defineConfig({
  site: 'https://platform.yosp.app',
  base: '/ajuda',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  markdown: {
    remarkPlugins: [remarkHelp],
    rehypePlugins: [rehypeHelp],
    smartypants: false,
  },
  image: {
    // Capturas em 2x (até 2880px): gera srcset e serve o tamanho certo para a coluna do artigo.
    layout: 'constrained',
    responsiveStyles: false,
    // Coluna de 720px: 1x, 2x e celulares. Menos variantes = build mais rápido e dist menor.
    breakpoints: [480, 720, 1080, 1440, 2160],
  },
  vite: {
    // O conteúdo fica fora do projeto (../support).
    server: { fs: { allow: ['..'] } },
  },
});

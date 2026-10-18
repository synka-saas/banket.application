#!/usr/bin/env node
// Recopia os tokens do design system do Banket (src/styles/tokens.css do app) para src/styles/tokens.css da ajuda.
// Os @font-face ficam de fora (as fontes da ajuda estão em global.css, em /ajuda/fonts). Rodar em help/site.
import fs from 'node:fs';
import path from 'node:path';

const origem = path.resolve(process.cwd(), '../../src/styles/tokens.css');
const destino = path.resolve(process.cwd(), 'src/styles/tokens.css');
const css = fs.readFileSync(origem, 'utf8');
const inicio = css.indexOf('/* Banket — color tokens');
if (inicio < 0) throw new Error(`Não achei o bloco de cores em ${origem}`);
const cabecalho = `/* Tokens do design system do Banket — cópia de src/styles/tokens.css do app (sem os @font-face: as fontes ficam em
   global.css, servidas de /ajuda/fonts). Não edite à mão: ao mudar o design system, rode \`npm run sync:tokens\`
   (ver help/DEPLOY.md, "Atualizar o layout"). */
`;
fs.writeFileSync(destino, cabecalho + css.slice(inicio));
console.log(`tokens.css atualizado a partir de ${path.relative(process.cwd(), origem)}`);

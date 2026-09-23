// Captura telas autenticadas para revisão visual contra os frames.
// Uso: node scripts/screenshots.mjs <pasta-saida> <rota> [rota...]
//   Variáveis: APP_URL (padrão http://localhost:4321), SHOT_EMAIL, SHOT_SENHA
//   Uma rota pode terminar com "#click=<seletor>" para clicar antes da captura (ex.: abrir um drawer).
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const [outDir, ...rotas] = process.argv.slice(2);
if (!outDir || rotas.length === 0) {
  console.error('Uso: node scripts/screenshots.mjs <pasta-saida> <rota> [rota...]');
  process.exit(1);
}
const base = process.env.APP_URL ?? 'http://localhost:4321';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });

await page.goto(`${base}/auth/login`);
await page.fill('#email', process.env.SHOT_EMAIL ?? 'leandro@banket.com.br');
await page.fill('#senha', process.env.SHOT_SENHA ?? 'Banket.2026');
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/auth')), page.click('button[type=submit]')]);

for (const entrada of rotas) {
  const [rota, acao] = entrada.split('#click=');
  await page.goto(`${base}${rota}`, { waitUntil: 'networkidle' });
  if (acao) {
    await page.click(acao);
    await page.waitForTimeout(400);
  }
  const nome = entrada.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '_') || 'home';
  const arquivo = path.join(outDir, `${nome}.png`);
  await page.screenshot({ path: arquivo, fullPage: !acao });
  console.log(arquivo);
}

await browser.close();

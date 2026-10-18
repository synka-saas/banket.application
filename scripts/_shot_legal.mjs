import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [w, h, n] of [[1440, 1000, 'desk'], [390, 844, 'mob']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  for (const s of ['privacidade', 'cookies']) {
    await p.goto(`https://banket.com.br/${s}/`, { waitUntil: 'networkidle' });
    await p.screenshot({ path: `${process.argv[2]}/legal_${s}_${n}.png` });
    if (s === 'cookies') { await p.locator('#necessarios').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${process.argv[2]}/legal_${s}_tabela_${n}.png` }); }
  }
  const largura = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log(n, 'scrollWidth', largura);
}
await b.close();

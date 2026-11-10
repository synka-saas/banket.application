import { chromium } from 'playwright';
const base='http://127.0.0.1:4400', out=process.argv[2];
const b=await chromium.launch();
for (const [w,h,suf] of [[1440,1000,'desk'],[390,844,'mob']]) {
const p=await b.newPage({viewport:{width:w,height:h}});
await p.goto(base+'/auth/login'); await p.fill('#email','leandro@banket.com.br'); await p.fill('#senha','Banket.2026');
await Promise.all([p.waitForURL(u=>!u.pathname.startsWith('/auth')),p.click('button[type=submit]')]);
await p.goto(base+'/formularios',{waitUntil:'networkidle'});
const href=await p.locator('a[href^="/formularios/"]').evaluateAll(as=>as.map(a=>a.getAttribute('href')).find(h=>/^\/formularios\/[0-9a-f-]{36}$/.test(h)));
await p.goto(base+href,{waitUntil:'networkidle'});
await p.getByRole('button',{name:'Editar opções'}).first().click();
await p.waitForTimeout(500);
await p.fill('#fe-opcao-nova','Acima de R$ 100.000'); await p.keyboard.press('Enter');
await p.fill('#fe-opcao-nova','Até R$ 10.000'); await p.keyboard.press('Enter');
await p.waitForTimeout(200);
await p.screenshot({path:`${out}/opcoes-${suf}.png`});
await p.locator('.fe-opcao-remover').first().click();
await p.getByRole('button',{name:'Aplicar opções'}).click();
await p.waitForTimeout(300);
console.log(suf, await p.locator('.fe-drawer').count(), await p.locator('.fe-estado').innerText());
}
await b.close();

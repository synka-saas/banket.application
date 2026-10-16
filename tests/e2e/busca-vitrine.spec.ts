import { expect, test } from '@playwright/test';
import { psql } from './helpers';

// Banket Busca, fase 3: vitrine pública e ranking. Usa o seed 011_busca_demo (clientes Banket: Sabor de Festa, Casa
// Jardim, Mesa Posta, Villa Toscana; gratuitos: Brasa & Cia, Doce Encanto, Food Truck, Ateliê, Recanto; não
// publicado: Sabores do ABC). Em dev a vitrine fica em /vitrine; com BUSCA_URL, use VITRINE=<url da vitrine>.
const V = process.env.VITRINE ?? '/vitrine';
const nomes = async (page: import('@playwright/test').Page) => page.locator('[data-buffet]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.nome));

test.describe('Banket Busca: vitrine', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.clear());
  });

  test('home: buscador, tipos com contagem real, destaques e depoimentos; JSON-LD do site', async ({ page }) => {
    await page.goto(`${V}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('buffet certo');
    await expect(page.getByRole('search', { name: 'Buscar buffets' })).toBeVisible();
    await expect(page.locator('.vh-categoria', { hasText: 'Casamento' })).toContainText(/\d+ buffets?/);
    await expect(page.locator('#h-destaques')).toBeVisible();
    await expect(page.locator('.vh-depoimento').first()).toBeVisible();
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(ld!)['@type']).toBe('WebSite');
  });

  test('busca: clientes Banket primeiro, selo e disponibilidade só para cliente', async ({ page }) => {
    const data = psql(`SELECT to_char(current_date + 3, 'YYYY-MM-DD')`);
    await page.goto(`${V}/buscar?tipo=aniversario&cidade=santo-andre-sp&data=${data}`);
    const lista = await nomes(page);
    expect(lista.slice(0, 2).sort()).toEqual(['Buffet Sabor de Festa', 'Villa Toscana Recepções']);
    const sabor = page.locator('[data-buffet="buffet-sabor-de-festa"]');
    await expect(sabor).toContainText('Cliente Banket');
    await expect(sabor).toContainText('Disponível na data');
    const brasa = page.locator('[data-buffet="brasa-e-cia-churrasco"]');
    await expect(brasa).not.toContainText('Cliente Banket');
    await expect(brasa).toContainText('Consultar disponibilidade');
  });

  test('data ocupada na agenda elimina só o cliente Banket', async ({ page }) => {
    const ocupada = psql(`SELECT to_char(min(e.data_evento), 'YYYY-MM-DD') FROM eventos e JOIN status_orcamento s ON s.id = e.status_id
                          JOIN tenants t ON t.id = e.tenant_id WHERE t.slug = 'buffet-sabor-de-festa' AND s.variante = 'aprovado' AND e.data_evento >= current_date`);
    await page.goto(`${V}/buscar?tipo=aniversario&cidade=santo-andre-sp&data=${ocupada}`);
    const lista = await nomes(page);
    expect(lista).not.toContain('Buffet Sabor de Festa');
    expect(lista).toContain('Brasa & Cia Churrasco');
  });

  test('capacidade e tipo eliminam; filtros ficam na URL e viram chips', async ({ page }) => {
    await page.goto(`${V}/buscar?tipo=infantil&cidade=santo-andre-sp&convidados=80`);
    expect((await nomes(page)).sort()).toEqual(['Buffet Sabor de Festa', 'Doce Encanto Festas']);
    await page.locator('.vr-lateral').getByLabel('Espaço próprio do buffet').check();
    await page.waitForURL(/local=espaco/);
    await expect(page.locator('.vr-chip', { hasText: 'Espaço próprio' })).toBeVisible();
    await page.locator('.vr-chip', { hasText: 'Espaço próprio' }).click();
    await page.waitForURL((u) => !u.search.includes('local='));
  });

  test('estado vazio com sugestões reais para ampliar a busca', async ({ page }) => {
    await page.goto(`${V}/buscar?tipo=casamento&cidade=santo-andre-sp&convidados=900`);
    await expect(page.locator('.vr-vazio')).toContainText('Nenhum buffet encontrado');
    const sugestao = page.locator('.vr-sugestao', { hasText: 'Sem o número de convidados' });
    await expect(sugestao).toBeVisible();
    await sugestao.click();
    await expect(page.locator('[data-buffet]').first()).toBeVisible();
  });

  test('seleção múltipla monta o pedido para vários buffets (máximo 5)', async ({ page }) => {
    await page.goto(`${V}/buscar?tipo=aniversario&cidade=santo-andre-sp`);
    const caixas = page.locator('[data-selecionar]');
    await caixas.nth(0).check();
    await caixas.nth(1).check();
    const barra = page.locator('[data-barra-selecao]');
    await expect(barra).toContainText('2 buffets selecionados');
    const href = await barra.locator('[data-pedir-selecao]').getAttribute('href');
    expect(href).toMatch(/orcamento\?tipo=aniversario&cidade=santo-andre-sp&buffets=[a-z-]+,[a-z-]+$/);
    await barra.getByRole('button', { name: 'Limpar' }).click();
    await expect(barra).toBeHidden();
  });

  test('perfil: cliente mostra cardápio, estimativa e JSON-LD; gratuito só pacotes', async ({ page }) => {
    await page.goto(`${V}/buffet/buffet-sabor-de-festa?convidados=80`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Buffet Sabor de Festa');
    await expect(page.locator('.vp-cabeca')).toContainText('Cliente Banket');
    await page.getByText('Ver cardápio').first().click();
    await expect(page.locator('.vp-cardapio').first()).toContainText('Coxinha de frango');
    await expect(page.locator('.vp-estimativa')).toContainText('80 convidados');
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    expect(ld.aggregateRating.reviewCount).toBeGreaterThan(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/buffet\/buffet-sabor-de-festa$/);

    await page.goto(`${V}/buffet/brasa-e-cia-churrasco?data=${psql(`SELECT to_char(current_date + 20, 'YYYY-MM-DD')`)}`);
    await expect(page.locator('#h-pacotes')).toHaveText('Pacotes');
    await expect(page.getByText('Ver cardápio')).toHaveCount(0);
    await expect(page.locator('.vp-aside')).toContainText('Consultar disponibilidade');
  });

  test('landing por tipo e cidade: título, perguntas, forma curta da URL e 404', async ({ page, request }) => {
    await page.goto(`${V}/buffet/casamento/campinas`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Buffet para casamento em Campinas');
    const tipos = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? '{}')['@type']));
    expect(tipos).toContain('FAQPage');
    const longa = await request.get(`${V}/buffet/casamento/campinas-sp`, { maxRedirects: 0 });
    expect(longa.status()).toBe(301);
    expect(longa.headers().location).toMatch(/\/buffet\/casamento\/campinas$/);
    expect((await request.get(`${V}/buffet/festa/campinas`)).status()).toBe(404);
  });

  test('nunca expõe perfil não publicado nem empresa suspensa', async ({ request }) => {
    expect((await request.get(`${V}/buffet/sabores-do-abc`)).status()).toBe(404);
    const buscaAntes = await (await request.get(`${V}/buscar?cidade=santo-andre-sp`)).text();
    expect(buscaAntes).not.toContain('Sabores do ABC');
    psql(`UPDATE tenants SET status = 'suspended' WHERE slug = 'doce-encanto-festas'`);
    try {
      expect((await request.get(`${V}/buffet/doce-encanto-festas`)).status()).toBe(404);
      expect(await (await request.get(`${V}/buscar?cidade=sao-caetano-do-sul-sp`)).text()).not.toContain('Doce Encanto');
    } finally {
      psql(`UPDATE tenants SET status = 'active' WHERE slug = 'doce-encanto-festas'`);
    }
  });

  test('páginas públicas sem cookie e com cache; busca livre fora do índice', async ({ request }) => {
    const res = await request.get(`${V}/buffet/casa-jardim-eventos`);
    expect(res.headers()['set-cookie']).toBeUndefined();
    expect(res.headers()['cache-control']).toContain('s-maxage=300');
    expect(await (await request.get(`${V}/buscar`)).text()).toContain('<meta name="robots" content="noindex, follow"');
  });
});

test.describe('Banket Busca: vitrine no celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('resumo editável e gaveta de filtros', async ({ page }) => {
    await page.goto(`${V}/buscar?tipo=aniversario&cidade=santo-andre-sp`);
    await expect(page.locator('.fbusca--barra')).toBeHidden();
    await page.locator('[data-resumo-botao]').click();
    await expect(page.locator('.fbusca--barra')).toBeVisible();
    await page.getByRole('button', { name: /Filtros/ }).click();
    const gaveta = page.locator('[data-gaveta-filtros]');
    await expect(gaveta).toBeVisible();
    await gaveta.getByLabel('Em domicílio').check();
    await gaveta.getByRole('button', { name: 'Ver buffets' }).click();
    await page.waitForURL(/local=domicilio/);
  });
});

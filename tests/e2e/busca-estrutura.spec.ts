import { expect, test } from '@playwright/test';
import { login, psql } from './helpers';

// Banket Busca, fase 2 (estrutura): base de cidades, rota pública de fotos, layout da vitrine com SEO e o vínculo
// entre plano e perfil (nível e excedentes). Usa o seed 011_busca_demo e a empresa gratuita do seed 010.

const GRATUITO = { email: 'gratuito@buffetgratis.com.br', senha: 'Banket.2026' };
const TENANT = "(SELECT id FROM tenants WHERE slug = 'buffet-gratuito')";

test.describe('Banket Busca: estrutura', () => {
  test('autocomplete de cidades sem acento e público', async ({ request }) => {
    const res = await request.get('/api/vitrine/cidades?q=santo andre');
    expect(res.status()).toBe(200);
    const cidades = await res.json();
    expect(cidades[0]).toMatchObject({ nome: 'Santo André', uf: 'SP', slug: 'santo-andre-sp' });
    expect(await (await request.get('/api/vitrine/cidades?q=s')).json()).toEqual([]);
  });

  test('fotos públicas: só a pasta busca/ e só imagens rasterizadas', async ({ request }) => {
    const tenant = psql(`SELECT ${TENANT}`);
    for (const caminho of [`empresa/logo.png`, `busca/x.svg`, `busca/../empresa/logo.png`, `busca/00000000-0000-0000-0000-000000000000.png`]) {
      const res = await request.get(`/busca-media/${tenant}/${caminho}`, { maxRedirects: 0 });
      expect(res.status(), caminho).toBe(404);
    }
    expect((await request.get('/busca-demo/mesa-1.svg')).status()).toBe(200);
  });

  test('layout da vitrine: público, com metadados e marca', async ({ page }) => {
    const res = await page.goto('/vitrine');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle('Encontre o buffet certo para o seu evento · Banket Busca');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Buffets e catering/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Banket Busca/);
    await expect(page.locator('.vitrine-topo .marca-busca-pill')).toHaveText('busca');
    await expect(page.locator('.vitrine-rodape')).toContainText('Cadastrar meu buffet');
    await expect(page.locator('main')).toContainText('9 buffets já publicaram o perfil');
  });

  test('perfil acompanha o plano: nível e excedentes de fotos e tipos, restaurados no upgrade', async ({ page }) => {
    test.setTimeout(120_000);
    // Perfil da empresa gratuita com mais fotos e tipos do que o plano Busca permite (simula um rebaixamento)
    psql(`DELETE FROM busca_perfis WHERE tenant_id = ${TENANT};
          UPDATE tenants SET plano_id = (SELECT id FROM planos WHERE slug = 'busca'), trial_ate = NULL, trial_usado_em = NULL,
                 trial_iniciado_em = NULL, trial_recusado_em = NULL WHERE id = ${TENANT};
          INSERT INTO busca_perfis (tenant_id, slug, nome, nivel, tipos_evento, tipos_servico)
          VALUES (${TENANT}, 'e2e-buffet-gratuito', 'Buffet Gratuito Demo', 'cliente', ARRAY['casamento','aniversario','infantil','formatura'], ARRAY['buffet_completo','churrasco']);
          INSERT INTO busca_fotos (tenant_id, perfil_id, path, ordem, capa)
          SELECT ${TENANT}, p.id, '/busca-demo/mesa-' || g || '.svg', g, g = 1 FROM busca_perfis p, generate_series(1, 6) g WHERE p.tenant_id = ${TENANT};`);
    await new Promise((r) => setTimeout(r, 17_000)); // cache do plano (15 s)

    // Teste grátis (sai do gratuito) e depois volta ao Busca pelo vencimento: aplica os excedentes
    await login(page, GRATUITO);
    const prime = psql(`SELECT id FROM planos WHERE slug = 'prime'`);
    expect((await page.request.post('/api/planos/trial', { data: { plano_id: prime } })).status()).toBe(200);
    expect(psql(`SELECT nivel FROM busca_perfis WHERE tenant_id = ${TENANT}`)).toBe('cliente');
    psql(`UPDATE tenants SET trial_ate = (now() AT TIME ZONE 'America/Sao_Paulo')::date - 2 WHERE id = ${TENANT}`);
    await page.waitForTimeout(17_000);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/busca/);

    expect(psql(`SELECT nivel || '|' || array_length(tipos_evento, 1) || '|' || (excedentes -> 'tipos_evento')::text FROM busca_perfis WHERE tenant_id = ${TENANT}`)).toBe(
      'gratuito|3|["formatura"]'
    );
    expect(psql(`SELECT count(*) FILTER (WHERE bloqueado_plano_em IS NULL) || '|' || count(*) FROM busca_fotos WHERE tenant_id = ${TENANT}`)).toBe('5|6');
    expect(psql(`SELECT capa::text FROM busca_fotos WHERE tenant_id = ${TENANT} AND bloqueado_plano_em IS NOT NULL`)).toBe('false');

    // Sair do gratuito de novo (teste liberado outra vez só para o e2e) restaura fotos e tipos
    psql(`UPDATE tenants SET trial_usado_em = NULL WHERE id = ${TENANT}`);
    await page.waitForTimeout(17_000);
    expect((await page.request.post('/api/planos/trial', { data: { plano_id: prime } })).status()).toBe(200);
    expect(psql(`SELECT nivel || '|' || array_length(tipos_evento, 1) || '|' || excedentes::text FROM busca_perfis WHERE tenant_id = ${TENANT}`)).toBe('cliente|4|{}');
    expect(psql(`SELECT count(*) FROM busca_fotos WHERE tenant_id = ${TENANT} AND bloqueado_plano_em IS NOT NULL`)).toBe('0');
  });

  test.afterAll(() => {
    psql(`DELETE FROM busca_perfis WHERE tenant_id = ${TENANT};
          UPDATE tenants SET plano_id = (SELECT id FROM planos WHERE slug = 'busca'), trial_ate = NULL, trial_iniciado_em = NULL,
                 trial_usado_em = NULL, trial_recusado_em = NULL, plano_rebaixado_em = NULL WHERE id = ${TENANT};`);
  });
});

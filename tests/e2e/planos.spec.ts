import { expect, test } from '@playwright/test';
import { login, psql } from './helpers';

// Planos e gating (fase 1 do Banket Busca). Usa a empresa "banket" (plano Completo, backfill da migration 031)
// e a empresa "buffet-gratuito" (plano Busca, seed 010_planos_demo). O teste grátis e o rebaixamento alteram a
// empresa gratuita e a devolvem ao estado inicial no fim.

const GRATUITO = { email: 'gratuito@buffetgratis.com.br', senha: 'Banket.2026' };
const TENANT_GRATUITO = "(SELECT id FROM tenants WHERE slug = 'buffet-gratuito')";
const EXTRA = 'e2e-excedente@example.com';
const CACHE_MS = 17_000;

function resetarGratuito() {
  psql(`UPDATE tenants SET plano_id = (SELECT id FROM planos WHERE slug = 'busca'), trial_ate = NULL, trial_iniciado_em = NULL,
          trial_usado_em = NULL, trial_recusado_em = NULL, plano_rebaixado_em = NULL WHERE id = ${TENANT_GRATUITO};
        DELETE FROM tenant_usuarios WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = '${EXTRA}');
        DELETE FROM usuarios WHERE email = '${EXTRA}';`);
}

test.describe.serial('Planos e gating', () => {
  // O plano fica 15 s em cache por processo (lib/planos/gating): depois de mexer no banco, espera o cache expirar
  test.beforeAll(async () => {
    resetarGratuito();
    await new Promise((r) => setTimeout(r, CACHE_MS));
  });
  test.afterAll(() => resetarGratuito());

  test('empresa no plano Completo: nada bloqueado (sem regressão)', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('.sidebar .nav-item--bloqueado')).toHaveCount(0);
    await expect(page.locator('.sidebar')).toContainText('Banket Busca');
    for (const rota of ['/eventos', '/inbox', '/cardapio/itens', '/financeiro', '/configuracoes/usuarios']) {
      const res = await page.goto(rota);
      expect(res?.status(), rota).toBe(200);
      expect(new URL(page.url()).pathname, rota).toBe(rota);
    }
    expect((await page.request.get('/api/templates/imagem-fundo')).status()).toBe(200);
    await page.goto('/planos');
    await expect(page.locator('.planos-cabecalho')).toContainText('Seu plano: Completo');
    await expect(page.getByRole('button', { name: 'Testar 30 dias grátis' })).toHaveCount(0);
  });

  test('plano Busca: cai no Banket Busca, módulos com cadeado e upsell', async ({ page }) => {
    await login(page, GRATUITO);
    await expect(page).toHaveURL(/\/busca$/);
    await expect(page.locator('.sidebar .nav-item--bloqueado').first()).toBeVisible();
    await expect(page.locator('.sidebar .nav-item--bloqueado')).not.toHaveCount(0);
    await expect(page.locator('.sidebar-plano')).toContainText('Plano Busca');

    // Página de módulo → redirect com o painel de upsell aberto
    await page.goto('/eventos');
    await expect(page).toHaveURL(/\/busca$/);
    const upsell = page.locator('dialog[data-upsell]');
    await expect(upsell).toBeVisible();
    await expect(upsell).toContainText('Propostas que fecham mais eventos');
    await expect(upsell.getByRole('link', { name: 'Iniciar teste grátis de 30 dias' })).toBeVisible();
    await upsell.getByRole('button', { name: 'Fechar' }).click();

    // Clique num item com cadeado abre o painel sem navegar
    await page.locator('.sidebar [data-bloqueado="financeiro"]').click();
    await expect(upsell).toBeVisible();
    await expect(upsell).toContainText('Financeiro do evento');
    await expect(page).toHaveURL(/\/busca$/);

    // API de módulo fora do plano → 403 padronizado
    const api = await page.request.get('/api/templates/imagem-fundo');
    expect(api.status()).toBe(403);
    expect(await api.json()).toMatchObject({ code: 'RECURSO_FORA_DO_PLANO', recurso: 'templates', upgrade_url: '/planos' });

    expect(Number(psql(`SELECT count(*) FROM busca_upsell_eventos WHERE tenant_id = ${TENANT_GRATUITO} AND tipo = 'cadeado_visto'`))).toBeGreaterThan(0);
  });

  test('teste grátis libera o plano e, vencido, volta ao Busca com excedentes bloqueados', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, GRATUITO);
    await page.goto('/planos?teste=1');
    const card = page.locator('.plano-card').filter({ hasText: 'Profissional' });
    await card.getByRole('button', { name: 'Testar 30 dias grátis' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('.toast').first()).toContainText('Seu teste do plano Profissional começou');
    await expect(page.locator('.sidebar .nav-item--bloqueado')).toHaveCount(0);
    await expect(page.locator('.sidebar-plano')).toContainText('Teste do Profissional');
    expect(psql(`SELECT p.slug || '|' || (t.trial_ate - (now() AT TIME ZONE 'America/Sao_Paulo')::date) FROM tenants t JOIN planos p ON p.id = t.plano_id WHERE t.id = ${TENANT_GRATUITO}`)).toBe('profissional|30');

    // Uma vez por empresa
    const segundo = await page.request.post('/api/planos/trial', { data: { plano_id: psql(`SELECT id FROM planos WHERE slug = 'prime'`) } });
    expect(segundo.status()).toBe(403);
    expect((await segundo.json()).code).toBe('TRIAL_INDISPONIVEL');

    // Durante o teste entra um segundo usuário; depois o teste vence (D+1 12h já passou)
    psql(`INSERT INTO usuarios (nome, email, senha_hash, email_verificado_em) VALUES ('Excedente E2E', '${EXTRA}', crypt('Banket.2026', gen_salt('bf')), now());
          INSERT INTO tenant_usuarios (tenant_id, usuario_id, role, ativo) SELECT ${TENANT_GRATUITO}, id, 'usuario', true FROM usuarios WHERE email = '${EXTRA}';
          UPDATE tenants SET trial_ate = (now() AT TIME ZONE 'America/Sao_Paulo')::date - 2 WHERE id = ${TENANT_GRATUITO};`);
    // Depois do cache do plano expirar, a próxima página rebaixa
    await page.waitForTimeout(CACHE_MS);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/busca/);
    await expect(page.locator('.sidebar-plano')).toContainText('Plano Busca');
    await expect(page.locator('.sidebar-plano')).toContainText('Ver planos'); // o teste já foi usado

    expect(psql(`SELECT p.slug FROM tenants t JOIN planos p ON p.id = t.plano_id WHERE t.id = ${TENANT_GRATUITO}`)).toBe('busca');
    expect(psql(`SELECT motivo FROM tenant_plano_historico WHERE tenant_id = ${TENANT_GRATUITO} ORDER BY created_at DESC LIMIT 1`)).toBe('trial_encerrado');
    expect(
      psql(`SELECT tu.ativo || '|' || (tu.bloqueado_plano_em IS NOT NULL) FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id
             WHERE u.email = '${EXTRA}' AND tu.tenant_id = ${TENANT_GRATUITO}`)
    ).toBe('false|true');
    expect(
      psql(`SELECT tu.ativo::text FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id WHERE u.email = '${GRATUITO.email}'`)
    ).toBe('true');
  });
});

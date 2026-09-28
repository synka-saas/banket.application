import { expect, test } from '@playwright/test';
import { login, psql } from './helpers';

// Controle de acesso: rotas sem login, papel "usuario", isolamento entre empresas e cabeçalhos de segurança.
// Usa os dados de demonstração (seeds): empresa "banket" e empresa "outro-buffet".

const BANKET = "(SELECT id FROM tenants WHERE slug = 'banket')";
const OUTRO = { email: 'demo@outrobuffet.com.br', senha: 'Banket.2026' };
const OPERACAO = { email: 'operacao@banket.com.br', senha: 'Banket.2026' };

test.describe('Segurança e isolamento', () => {
  test('sem login: páginas redirecionam ao login e APIs respondem 401', async ({ request }) => {
    for (const rota of ['/dashboard', '/eventos', '/agenda', '/clientes', '/templates', '/configuracoes/usuarios']) {
      const res = await request.get(rota, { maxRedirects: 0 });
      expect(res.status(), rota).toBe(302);
      expect(res.headers().location, rota).toContain('/auth/login?next=');
    }
    const api = await request.put('/api/orcamentos/00000000-0000-0000-0000-000000000000/versoes/1', { data: {} });
    expect(api.status()).toBe(401);
    const upload = await request.get(`/uploads/${psql(`SELECT ${BANKET}`)}/empresa/x.png`, { maxRedirects: 0 });
    expect(upload.status()).toBe(302);
  });

  test('papel "usuario" não acessa Configurações', async ({ page }) => {
    await login(page, OPERACAO);
    await expect(page.locator('.user-role')).toContainText('Usuário');
    await expect(page.locator('.sidebar')).not.toContainText('Configurações');
    await page.goto('/configuracoes/usuarios');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('.toast').first()).toContainText('restrito a administradores');
    const api = await page.request.get('/api/configuracoes/categorias/tipos');
    expect(api.status()).toBe(403);
  });

  test('outra empresa não enxerga nem altera dados da banket', async ({ page }) => {
    const [eventoId, versaoId] = psql(
      `SELECT e.id || '|' || v.id FROM eventos e JOIN orcamentos o ON o.evento_id = e.id
         JOIN orcamento_versoes v ON v.orcamento_id = o.id WHERE e.tenant_id = ${BANKET} LIMIT 1`
    ).split('|');
    const clienteId = psql(`SELECT id FROM clientes WHERE tenant_id = ${BANKET} LIMIT 1`);
    const templateId = psql(`SELECT id FROM orcamento_templates WHERE tenant_id = ${BANKET} LIMIT 1`);
    const tenantBanket = psql(`SELECT ${BANKET}`);

    await login(page, OUTRO);
    for (const rota of [`/eventos/${eventoId}`, `/eventos/${eventoId}/orcamento`, `/clientes/${clienteId}`, `/templates/${templateId}`]) {
      const res = await page.goto(rota);
      expect(res?.status(), rota).toBe(404);
    }
    // PDF redireciona com erro (sem expor o arquivo)
    const pdf = await page.request.get(`/eventos/${eventoId}/orcamento/pdf`, { maxRedirects: 0 });
    expect(pdf.status()).toBe(302);
    // Escrita pela API: o orçamento não existe para esta empresa
    const put = await page.request.put(`/api/orcamentos/${eventoId}/versoes/1`, { data: { observacoes: 'invasão' } });
    expect(put.status()).toBeGreaterThanOrEqual(400);
    expect(psql(`SELECT COALESCE(conteudo->>'observacoes', '') FROM orcamento_versoes WHERE id = '${versaoId}'`)).not.toBe('invasão');
    // Mover no Kanban
    const status = await page.request.patch(`/api/eventos/${eventoId}/status`, { data: { status_id: eventoId } });
    expect(status.status()).toBeGreaterThanOrEqual(400);
    // Arquivos de outra empresa
    const upload = await page.request.get(`/uploads/${tenantBanket}/empresa/qualquer.png`);
    expect(upload.status()).toBe(404);
    // Rotas de impressão exigem token assinado
    expect((await page.request.get(`/print/orcamento/${versaoId}`)).status()).toBe(401);
    expect((await page.request.get(`/print/orcamento/${versaoId}?token=forjado`)).status()).toBe(401);
    // Trocar para uma empresa da qual não participa
    // Sem Origin, o POST de formulário é recusado (proteção contra CSRF do Astro)
    const semOrigem = await page.request.post('/api/sessao/empresa', { form: { tenant_id: tenantBanket }, maxRedirects: 0 });
    expect(semOrigem.status()).toBe(403);
    const troca = await page.request.post('/api/sessao/empresa', {
      form: { tenant_id: tenantBanket },
      headers: { Origin: new URL(page.url()).origin },
      maxRedirects: 0,
    });
    expect(troca.status()).toBe(302);
    await page.goto('/dashboard');
    await expect(page.locator('.toast').first()).toContainText('não tem acesso');
    await page.goto(`/eventos/${eventoId}`);
    await expect(page.locator('main')).toContainText('Página não encontrada');
  });

  test('cabeçalhos de segurança', async ({ request }) => {
    const res = await request.get('/auth/login');
    const h = res.headers();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('SAMEORIGIN');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    const redirect = await request.get('/dashboard', { maxRedirects: 0 });
    expect(redirect.headers()['x-frame-options']).toBe('SAMEORIGIN');
  });
});

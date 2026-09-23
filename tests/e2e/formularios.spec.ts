import { expect, test } from '@playwright/test';
import { expectToast, login, waitForIslands } from './helpers';

test.describe('Formulários', () => {
  test('configura um formulário e recebe um pedido pela página pública', async ({ page }) => {
    const ts = Date.now();
    const nome = `E2E Formulário ${ts}`;
    const email = `e2e.form.${ts}@exemplo.com`;

    await login(page);
    await page.goto('/formularios');
    await page.getByRole('button', { name: 'Criar formulário' }).click();
    await page.waitForURL(/\/formularios\/[0-9a-f-]{36}$/);
    const formId = page.url().split('/').pop()!;
    await waitForIslands(page);

    await page.getByLabel('Nome do formulário*').fill(nome);

    // Perguntas essenciais não têm toggle
    const email_ = page.locator('[data-pergunta="email"]');
    await expect(email_).toContainText('Obrigatória');
    await expect(email_.locator('.switch')).toHaveCount(0);

    // Desativa uma pergunta padrão do fluxo social
    await page.getByLabel('Pergunta Restrições e preferências alimentares ativa').uncheck();

    // Inclui uma pergunta personalizada obrigatória em Gastronomia
    const gastronomia = page.locator('[data-secao="gastronomia"]');
    await gastronomia.getByRole('button', { name: /Adicionar pergunta/ }).click();
    await gastronomia.getByLabel('Pergunta*').fill('Tema da festa');
    await gastronomia.getByText('Resposta obrigatória').click();
    await gastronomia.getByRole('button', { name: 'Incluir pergunta' }).click();
    await expect(gastronomia.locator('.fe-pergunta').last()).toContainText('Tema da festa *');

    await page.getByRole('button', { name: 'Salvar' }).click();
    await expectToast(page, 'Formulário salvo.');
    await waitForIslands(page);
    const slug = await page.locator('#fe-slug').inputValue();

    // ---------- Página pública (sem login) ----------
    await page.context().clearCookies();
    await page.goto(`/f/${slug}`);
    await page.getByLabel('Nome / Responsável').fill('Cliente E2E');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('WhatsApp').fill('11988887777');
    await expect(page.getByLabel('WhatsApp')).toHaveValue('(11) 98888-7777');
    await page.getByText('Social (B2C)').click();
    await page.getByRole('button', { name: 'Avançar' }).click();

    // Infraestrutura só aparece para local externo
    await expect(page.getByText('Como é a infraestrutura do local?')).toBeHidden();
    await page.getByText('Local externo').click();
    await expect(page.getByText('Como é a infraestrutura do local?')).toBeVisible();
    await page.getByText('Possui cozinha equipada').click();
    await page.getByRole('button', { name: 'Avançar' }).click();

    // Fluxo social: sem perguntas B2B e sem a pergunta desativada
    await expect(page.getByLabel('Razão social / Empresa')).toBeHidden();
    await expect(page.getByText('Restrições e preferências alimentares')).toHaveCount(0);
    await page.getByLabel('Ocasião').selectOption('casamento');
    await page.getByLabel('Data do evento').fill('2027-06-12');
    await page.getByLabel('Convidados adultos').fill('90');
    await page.getByLabel('Crianças').fill('10');
    await page.getByLabel('Estimativa de investimento').selectOption('10k_25k');
    await page.getByRole('button', { name: 'Avançar' }).click();

    await page.getByText('Ilhas gastronômicas').click();
    await page.getByText('Open bar completo').click();
    await page.getByRole('button', { name: 'Avançar' }).click();
    await expectToast(page, 'Preencha "Tema da festa" para avançar.');
    await page.getByLabel('Tema da festa').fill('Jardim encantado');
    await page.getByRole('button', { name: 'Avançar' }).click();

    await page.getByLabel('Detalhes e desejos específicos').fill('Cerimônia ao ar livre.');
    await page.getByRole('button', { name: 'Finalizar solicitação' }).click();
    await expect(page.getByRole('heading', { name: 'Tudo certo!' })).toBeVisible();

    // ---------- Resposta registrada e evento criado ----------
    await login(page);
    await page.goto(`/formularios/${formId}/respostas`);
    const linha = page.locator('tr', { hasText: email });
    await expect(linha).toContainText('Social (B2C)');
    await linha.getByRole('link').click();
    await page.waitForURL(/\/eventos\/[0-9a-f-]{36}$/);

    await expect(page.locator('.banner')).toContainText('Cliente E2E');
    const respostas = page.locator('details', { hasText: 'Respostas do formulário' });
    await expect(respostas).toContainText('Jardim encantado');
    await expect(respostas).toContainText('Open bar completo (alcoólicos)');
    await expect(page.getByText('Local externo (empresa, residência ou espaço alugado)')).toBeVisible();

    await page.goto(`${page.url()}/linha-do-tempo`);
    await expect(page.getByText('Pedido recebido pelo formulário')).toBeVisible();

    // ---------- Limpeza ----------
    await page.goBack();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Excluir evento' }).click();
    await expectToast(page, 'Evento excluído.');

    await page.goto(`/formularios/${formId}`);
    await waitForIslands(page);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Excluir' }).click();
    await expectToast(page, 'Formulário removido.');
    await expect(page.locator('.info-card', { hasText: nome })).toHaveCount(0);

    // Link de formulário inexistente responde 404
    const res = await page.goto(`/f/${slug}`);
    expect(res?.status()).toBe(404);
  });
});

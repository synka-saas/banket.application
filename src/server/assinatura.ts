// Assinatura e cobrança pelo Stripe (modelo do Yosp: platform/src/pages/api/account/subscription/*,
// api/src/routes/stripe-webhook.js, api/src/billing/{sync,plan-change,scheduler}.js).
//
//   Teste:      o plano escolhido inicia o teste de 30 dias, sem cartão (server/planos.ts → iniciarTrial); durante o
//               teste a troca de plano é livre (escolherPlanoNoTeste).
//   Contratar:  iniciarCheckout. Cartão → Checkout hospedado (assinatura com cobrança automática); Pix → assinatura
//               send_invoice com 7 dias para pagar, paga na página do Banket (pixDaFatura). No teste, a 1ª cobrança
//               pode ser agora ou no fim do teste (trial_end no Stripe).
//   Plano:      só entra DEPOIS da confirmação do Stripe (promoverPlano): cartão com assinatura viva; Pix com a fatura
//               paga. Até lá fica em tenants.plano_pendente_id.
//   Rebaixar:   fim do teste sem assinatura, fatura vencida não paga às 12h de D+1 e assinatura encerrada levam ao
//               plano Busca (avaliarEmpresa → rebaixarParaBusca), cancelando a assinatura e anulando as faturas
//               abertas no Stripe antes. Regras puras em lib/planos/cobranca.ts.
//   Espelho:    tenants.stripe_* e assinatura_faturas, sempre a partir do objeto atual buscado na API (os eventos do
//               webhook chegam duplicados e fora de ordem). stripe_events dá a idempotência.
//
// Chamadas ao Stripe ficam fora das transações; a conexão de sistema só acha a empresa dona de um objeto do Stripe
// e roda o agendador (como o webhook do Resend); o resto grava em withTenant.
import type Stripe from 'stripe';
import { isAdmin, type SessionUser } from '../lib/auth';
import { systemQuery, withSystem, withTenant, type Db } from '../lib/db';
import { UserError } from '../lib/forms';
import { appUrl, sendMail } from '../lib/mail';
import { entitlements, invalidar } from '../lib/planos/gating';
import {
  ANTECEDENCIA_MINIMA_CHECKOUT_MS,
  ASSINATURA_ENCERRADA,
  ASSINATURA_VIVA,
  estadoCobranca,
  fimDoTesteNoStripe,
  passouDoPrazo,
  taxIdDoDocumento,
  type Ciclo,
  type EstadoCobranca,
  type Forma,
  type MotivoRebaixamento,
} from '../lib/planos/cobranca';
import { emSaoPaulo } from '../lib/planos/trial';
import { PIX_DIAS_PARA_PAGAR, PIX_QR_SEGUNDOS, cobrancaConfigurada, comStripe, idDe, instante, stripe } from '../lib/stripe';
import { emailLayout } from './emails';
import { destinatarios, planoPorId, rebaixarParaBusca, registrarUpsell, trocarPlano, type Plano } from './planos';

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export interface Cobranca {
  id: string;
  nome: string;
  razao_social: string | null;
  tipo_pessoa: 'PF' | 'PJ' | null;
  documento: string | null;
  email: string | null;
  endereco: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  plano_id: string | null;
  plano_nome: string | null;
  gratuito: boolean;
  plano_pendente_id: string | null;
  plano_pendente_nome: string | null;
  trial_ate: string | null;
  stripe_customer_id: string | null;
  stripe_assinatura_id: string | null;
  stripe_assinatura_status: string | null;
  cobranca_intervalo: Ciclo | null;
  forma_pagamento: Forma | null;
  cartao_bandeira: string | null;
  cartao_final: string | null;
  periodo_fim: Date | null;
  cancelar_no_fim: boolean;
  cancelar_em: Date | null;
  preco_mensal: number | null;
  preco_anual: number | null;
  fatura_id: string | null;
  fatura_valor: number | null;
  fatura_vencimento: string | null;
  fatura_motivo: string | null;
  fatura_paga: boolean;
  fatura_pix: boolean;
}

const SQL_COBRANCA = `
  SELECT t.id, t.nome, t.razao_social, t.tipo_pessoa, t.documento, t.email, t.endereco,
         t.cep, t.logradouro, t.numero, t.complemento, t.bairro, t.cidade, t.uf,
         t.plano_id, p.nome AS plano_nome, COALESCE(p.gratuito, false) AS gratuito,
         t.plano_pendente_id, pp.nome AS plano_pendente_nome,
         to_char(t.trial_ate, 'YYYY-MM-DD') AS trial_ate,
         t.stripe_customer_id, t.stripe_assinatura_id, t.stripe_assinatura_status, t.cobranca_intervalo,
         t.forma_pagamento, t.cartao_bandeira, t.cartao_final, t.periodo_fim, t.cancelar_no_fim, t.cancelar_em,
         p.preco_mensal, p.preco_anual,
         f.stripe_id AS fatura_id, f.valor_restante AS fatura_valor, to_char(f.vencimento, 'YYYY-MM-DD') AS fatura_vencimento,
         f.motivo AS fatura_motivo, COALESCE(f.cobranca = 'send_invoice', false) AS fatura_pix,
         EXISTS (SELECT 1 FROM assinatura_faturas fp WHERE fp.tenant_id = t.id AND fp.assinatura_id = t.stripe_assinatura_id
                    AND fp.status = 'paid' AND fp.valor > 0) AS fatura_paga
    FROM tenants t
    LEFT JOIN planos p ON p.id = t.plano_id
    LEFT JOIN planos pp ON pp.id = t.plano_pendente_id
    LEFT JOIN LATERAL (
      SELECT stripe_id, valor_restante, vencimento, motivo, cobranca FROM assinatura_faturas
       WHERE tenant_id = t.id AND status = 'open' AND assinatura_id = t.stripe_assinatura_id AND vencimento IS NOT NULL
       ORDER BY vencimento LIMIT 1) f ON true
   WHERE t.id = $1`;

export async function carregarCobranca(db: Db, tenantId: string): Promise<Cobranca | null> {
  const { rows } = await db.query<Cobranca>(SQL_COBRANCA, [tenantId]);
  return rows[0] ?? null;
}

/** Estado de cobrança (regras puras de lib/planos/cobranca.ts sobre o espelho local). */
export function estadoDe(c: Cobranca, agora = new Date()): { estado: EstadoCobranca; motivo?: MotivoRebaixamento } {
  return estadoCobranca(
    {
      gratuito: c.gratuito,
      semPlano: !c.plano_id,
      trialAte: c.trial_ate,
      assinaturaId: c.stripe_assinatura_id,
      assinaturaStatus: c.stripe_assinatura_status,
      faturaAberta: c.fatura_vencimento ? { vencimento: c.fatura_vencimento, motivo: c.fatura_motivo, pix: c.fatura_pix } : null,
      teveFaturaPaga: c.fatura_paga,
    },
    agora
  );
}

/** Assinatura existente no Stripe (não encerrada). Inclui a 1ª fatura Pix ainda em aberto. */
export const temAssinatura = (c: Pick<Cobranca, 'stripe_assinatura_id' | 'stripe_assinatura_status'>): boolean =>
  Boolean(c.stripe_assinatura_id) && ASSINATURA_VIVA.has(c.stripe_assinatura_status ?? '');

export interface Fatura {
  stripe_id: string;
  numero: string | null;
  status: string;
  valor: number;
  valor_restante: number;
  vencimento: string | null;
  pago_em: Date | null;
  forma: Forma | null;
  cobranca: string | null;
  url_fatura: string | null;
  pdf_url: string | null;
  plano_nome: string | null;
  periodo_inicio: Date | null;
  periodo_fim: Date | null;
  created_at: Date;
}

export async function listarFaturas(db: Db, limite = 24): Promise<Fatura[]> {
  const { rows } = await db.query<Fatura>(
    `SELECT f.stripe_id, f.numero, f.status, f.valor, f.valor_restante, to_char(f.vencimento, 'YYYY-MM-DD') AS vencimento,
            f.pago_em, f.forma, f.cobranca, f.url_fatura, f.pdf_url, p.nome AS plano_nome, f.periodo_inicio, f.periodo_fim, f.created_at
       FROM assinatura_faturas f LEFT JOIN planos p ON p.id = f.plano_id
      WHERE f.status <> 'draft'
      ORDER BY f.created_at DESC LIMIT $1`,
    [limite]
  );
  return rows;
}

/** Endereço no formato do Stripe (partes de Configurações › Empresa; sem elas, o texto montado). */
function enderecoStripe(c: Cobranca): Stripe.AddressParam | undefined {
  const line1 = [c.logradouro, c.numero].filter((x) => x?.trim()).join(', ') || c.endereco?.slice(0, 200) || '';
  if (!line1) return undefined;
  return {
    line1,
    line2: [c.complemento, c.bairro].filter((x) => x?.trim()).join(' – ') || undefined,
    city: c.cidade || undefined,
    state: c.uf || undefined,
    postal_code: c.cep || undefined,
    country: 'BR',
  };
}

// ---------------------------------------------------------------------------
// Cliente e preço
// ---------------------------------------------------------------------------

/** Dados fiscais exigidos na contratação (CPF/CNPJ válido; razão social para PJ). Lança UserError com o que falta. */
export function exigirPerfilFiscal(c: Cobranca): void {
  if (!taxIdDoDocumento(c.documento)) {
    throw new UserError('Informe um CPF ou CNPJ válido em Configurações › Empresa antes de assinar. Ele vai na cobrança e na nota fiscal.');
  }
  if (c.tipo_pessoa === 'PJ' && !String(c.razao_social ?? '').trim()) {
    throw new UserError('Informe a razão social em Configurações › Empresa antes de assinar.');
  }
}

async function emailDeCobranca(db: Db, c: Cobranca): Promise<string | null> {
  if (c.email) return c.email;
  const { rows } = await db.query<{ email: string }>(
    `SELECT u.email FROM tenant_usuarios tu JOIN usuarios u ON u.id = tu.usuario_id
      WHERE tu.tenant_id = $1 AND tu.role = 'owner' AND tu.ativo ORDER BY tu.created_at LIMIT 1`,
    [c.id]
  );
  return rows[0]?.email ?? null;
}

/** Customer do Stripe da empresa; criado na primeira contratação. */
async function obterOuCriarCliente(tenantId: string): Promise<{ clienteId: string; cobranca: Cobranca }> {
  const { c, email } = await withTenant(tenantId, async (db) => {
    const c = await carregarCobranca(db, tenantId);
    if (!c) throw new UserError('Empresa não encontrada.');
    return { c, email: await emailDeCobranca(db, c) };
  });
  exigirPerfilFiscal(c);
  const s = stripe();
  if (c.stripe_customer_id) {
    // Cliente apagado no Stripe (ex.: reset do modo de teste): cria outro em vez de falhar.
    const atual = await s.customers.retrieve(c.stripe_customer_id).catch((e) => (e?.code === 'resource_missing' ? null : Promise.reject(e)));
    if (atual && !(atual as Stripe.DeletedCustomer).deleted) return { clienteId: atual.id, cobranca: c };
    await withTenant(tenantId, (db) =>
      db.query('UPDATE tenants SET stripe_customer_id = NULL WHERE id = $1 AND stripe_customer_id = $2', [tenantId, c.stripe_customer_id])
    );
  }
  const taxId = taxIdDoDocumento(c.documento)!;
  const cliente = await s.customers.create(
    {
      name: c.razao_social || c.nome,
      email: email ?? undefined,
      address: enderecoStripe(c),
      preferred_locales: ['pt-BR'],
      metadata: { tenant_id: tenantId },
      tax_id_data: [{ type: taxId.type, value: taxId.value }],
    },
    { idempotencyKey: `banket-customer-${tenantId}-${Math.floor(Date.now() / 60_000)}` }
  );
  await withTenant(tenantId, (db) =>
    db.query('UPDATE tenants SET stripe_customer_id = $2 WHERE id = $1 AND stripe_customer_id IS NULL', [tenantId, cliente.id])
  );
  return { clienteId: cliente.id, cobranca: { ...c, stripe_customer_id: cliente.id } };
}

/** Plano contratável e o preço do Stripe do ciclo. */
async function precoDoPlano(db: Db, planoId: string, ciclo: Ciclo): Promise<{ plano: Plano; precoId: string }> {
  const { rows } = await db.query<{ mensal: string | null; anual: string | null }>(
    `SELECT stripe_price_mensal_id AS mensal, stripe_price_anual_id AS anual FROM planos
      WHERE id = $1 AND ativo AND publico AND NOT gratuito`,
    [planoId]
  );
  const plano = rows[0] ? await planoPorId(db, planoId) : null;
  if (!plano || !rows[0]) throw new UserError('Plano não encontrado.');
  const precoId = ciclo === 'ano' ? rows[0].anual : rows[0].mensal;
  if (!precoId) throw new UserError('Este plano ainda não está disponível para contratação pelo app. Fale com a equipe do Banket.');
  return { plano, precoId };
}

const exigirAdmin = (user: SessionUser) => {
  if (!isAdmin(user)) throw new UserError('Só proprietários e administradores podem cuidar da assinatura.');
};

// ---------------------------------------------------------------------------
// Contratação, troca, cancelamento, portal
// ---------------------------------------------------------------------------

export interface PedidoCheckout {
  planoId: string;
  ciclo: Ciclo;
  forma: Forma;
  /** No teste: true = cobra agora (o teste acaba); false = 1ª cobrança no fim do teste */
  cobrarAgora: boolean;
}

export type ResultadoCheckout = { url: string } | { pagarUrl: string } | { agendado: true; primeiraCobrancaEm: string };

export async function iniciarCheckout(user: SessionUser, pedido: PedidoCheckout): Promise<ResultadoCheckout> {
  exigirAdmin(user);
  const tenantId = user.tenantId;
  return comStripe(async () => {
    const { plano, precoId, c } = await withTenant(tenantId, async (db) => {
      const c = await carregarCobranca(db, tenantId);
      if (!c) throw new UserError('Empresa não encontrada.');
      if (temAssinatura(c) && c.fatura_motivo !== 'subscription_create') {
        throw new UserError('Sua empresa já tem uma assinatura. Para mudar de plano, use "Trocar plano".');
      }
      exigirPerfilFiscal(c);
      return { ...(await precoDoPlano(db, pedido.planoId, pedido.ciclo)), c };
    });
    const { clienteId } = await obterOuCriarCliente(tenantId);
    const s = stripe();
    // Checkout aberto em outra aba (vale 24 h): expira antes de abrir outro ou contratar por Pix, para nunca nascerem
    // duas assinaturas da mesma empresa.
    for await (const aberta of s.checkout.sessions.list({ customer: clienteId, status: 'open', limit: 20 })) {
      await s.checkout.sessions.expire(aberta.id).catch((err) => console.error('[assinatura] não expirou o checkout', aberta.id, err));
    }

    // Contratação Pix anterior com a 1ª fatura em aberto: troca pela nova (não deixa duas cobranças).
    if (c.stripe_assinatura_id && temAssinatura(c)) {
      await encerrarNoStripe(c.stripe_assinatura_id);
      await soltarAssinatura(tenantId, c.stripe_assinatura_id);
    }

    const { estado } = estadoDe(c);
    const fimTeste = c.trial_ate ? fimDoTesteNoStripe(c.trial_ate) : null;
    const noTeste = estado === 'trial' && fimTeste !== null && fimTeste.getTime() > Date.now();
    const adiar = noTeste && !pedido.cobrarAgora;
    const intervalo = pedido.ciclo === 'ano' ? 'year' : 'month';

    // O plano pago só entra após a confirmação do Stripe (promoverPlano). Até lá fica pendente.
    await withTenant(tenantId, async (db) => {
      await db.query('UPDATE tenants SET plano_pendente_id = $2 WHERE id = $1', [tenantId, plano.id]);
      await registrarUpsell(db, user, 'checkout_iniciado', null, { plano: plano.slug, ciclo: pedido.ciclo, forma: pedido.forma, adiar });
    });
    invalidar(tenantId);
    const metadata = { tenant_id: tenantId, plano_id: plano.id };

    if (pedido.forma === 'cartao') {
      if (adiar && fimTeste!.getTime() - Date.now() < ANTECEDENCIA_MINIMA_CHECKOUT_MS) {
        throw new UserError('Faltam menos de 2 dias para o fim do teste: no cartão, escolha cobrar agora.');
      }
      const sessao = await s.checkout.sessions.create({
        mode: 'subscription',
        customer: clienteId,
        client_reference_id: tenantId,
        line_items: [{ price: precoId, quantity: 1 }],
        payment_method_collection: 'always',
        locale: 'pt-BR',
        metadata,
        subscription_data: { metadata, ...(adiar ? { trial_end: Math.floor(fimTeste!.getTime() / 1000) } : {}) },
        success_url: appUrl('/configuracoes/financeiro?checkout=sucesso'),
        cancel_url: appUrl('/configuracoes/financeiro?checkout=cancelado'),
      });
      if (!sessao.url) throw new UserError('Não foi possível abrir a página de pagamento. Tente novamente.');
      return { url: sessao.url };
    }

    // Pix: assinatura com fatura enviada (send_invoice) e 7 dias para pagar.
    const assinatura = await s.subscriptions.create(
      {
        customer: clienteId,
        items: [{ price: precoId }],
        collection_method: 'send_invoice',
        days_until_due: PIX_DIAS_PARA_PAGAR,
        metadata,
        ...(adiar ? { trial_end: Math.floor(fimTeste!.getTime() / 1000) } : {}),
        expand: ['latest_invoice'],
      },
      { idempotencyKey: `banket-pix-${tenantId}-${plano.id}-${intervalo}-${adiar ? 'teste' : 'agora'}-${Math.floor(Date.now() / 60_000)}` }
    );
    await withTenant(tenantId, (db) =>
      db.query(
        `UPDATE tenants SET stripe_assinatura_id = $2, stripe_assinatura_status = $3, cobranca_intervalo = $4,
                forma_pagamento = 'pix', cartao_bandeira = NULL, cartao_final = NULL, cartao_validade = NULL,
                cancelar_no_fim = false, cancelar_em = NULL, cancelamento_motivo = NULL
          WHERE id = $1`,
        [tenantId, assinatura.id, assinatura.status, pedido.ciclo]
      )
    );
    invalidar(tenantId);
    if (adiar) return { agendado: true, primeiraCobrancaEm: fimTeste!.toISOString() };

    let fatura = assinatura.latest_invoice as Stripe.Invoice | null;
    if (fatura && fatura.status === 'draft') fatura = await s.invoices.finalizeInvoice(fatura.id!, { auto_advance: false });
    if (!fatura || fatura.status !== 'open') throw new UserError('Não foi possível gerar a fatura Pix. Tente novamente.');
    await sincronizarFatura(fatura);
    return { pagarUrl: `/configuracoes/financeiro/pagar/${fatura.id}` };
  });
}

/** Valor mensal equivalente de um preço do Stripe (anual ÷ 12), em centavos. */
function mensalDoPreco(p: Stripe.Price | null | undefined): number {
  const valor = p?.unit_amount ?? 0;
  return p?.recurring?.interval === 'year' ? valor / 12 : valor;
}

/**
 * Troca de plano com assinatura.
 * - Subida (o novo custa mais por mês) com a assinatura já cobrando: a diferença proporcional é faturada na hora
 *   (`always_invoice`). No cartão, com `pending_if_incomplete`, a troca só vale se o pagamento passar e o plano sobe
 *   em seguida; no Pix, a fatura fica em aberto e o plano novo entra quando ela for paga (promoverPlano, pelo
 *   webhook), ficando em `plano_pendente_id` até lá.
 * - Descida, ou assinatura ainda em teste no Stripe: o ajuste vai para a próxima fatura e o plano muda na hora.
 */
export async function trocarPlanoDaAssinatura(user: SessionUser, planoId: string, ciclo: Ciclo): Promise<Plano> {
  exigirAdmin(user);
  const tenantId = user.tenantId;
  return comStripe(async () => {
    const { c, plano, precoId } = await withTenant(tenantId, async (db) => {
      const c = await carregarCobranca(db, tenantId);
      if (!c || !temAssinatura(c) || c.fatura_motivo === 'subscription_create') {
        throw new UserError('Sua empresa ainda não tem assinatura. Assine um plano.');
      }
      return { c, ...(await precoDoPlano(db, planoId, ciclo)) };
    });
    const s = stripe();
    const atual = await s.subscriptions.retrieve(c.stripe_assinatura_id!, { expand: ['items.data.price'] });
    const item = atual.items.data[0];
    if (item?.price?.id === precoId) throw new UserError('Este já é o seu plano atual.');
    const novoPreco = await s.prices.retrieve(precoId);
    const subida = mensalDoPreco(novoPreco) > mensalDoPreco(item?.price);
    const cobrarAgora = subida && atual.status !== 'trialing';
    const pix = atual.collection_method === 'send_invoice';

    const nova = await s.subscriptions.update(atual.id, {
      items: [{ id: item.id, price: precoId }],
      proration_behavior: cobrarAgora ? 'always_invoice' : 'create_prorations',
      ...(cobrarAgora && !pix ? { payment_behavior: 'pending_if_incomplete' as const } : {}),
      metadata: { ...atual.metadata, plano_id: plano.id },
    });
    if (cobrarAgora && !pix && nova.pending_update) {
      throw new UserError('O pagamento da diferença não foi aprovado. Confira o cartão em "Cartão e recibos" e tente de novo.');
    }

    if (cobrarAgora && pix) {
      // Plano novo só depois de paga a fatura da diferença (webhook invoice.paid → promoverPlano)
      await withTenant(tenantId, async (db) => {
        await db.query('UPDATE tenants SET cobranca_intervalo = $2, plano_pendente_id = $3 WHERE id = $1', [tenantId, ciclo, plano.id]);
      });
      invalidar(tenantId);
      const aberta = (await s.invoices.list({ subscription: atual.id, status: 'open', limit: 1 })).data[0];
      if (aberta) await sincronizarFatura(aberta);
      return plano;
    }

    await withTenant(tenantId, async (db) => {
      await db.query('UPDATE tenants SET cobranca_intervalo = $2 WHERE id = $1', [tenantId, ciclo]);
      await trocarPlano(db, tenantId, plano.id, {
        motivo: subida ? 'upgrade' : 'downgrade',
        origem: 'stripe',
        usuarioId: user.id,
        dados: { stripe_assinatura_id: atual.id, ciclo },
        manterTrial: nova.status === 'trialing',
      });
    });
    return plano;
  });
}

/** Cancela no fim do período pago, nunca na hora. Desfazer: retomarAssinatura. */
export async function cancelarAssinatura(user: SessionUser, motivo: string): Promise<Date | null> {
  exigirAdmin(user);
  const tenantId = user.tenantId;
  return comStripe(async () => {
    const c = await withTenant(tenantId, (db) => carregarCobranca(db, tenantId));
    if (!c || !temAssinatura(c)) throw new UserError('Sua empresa não tem assinatura ativa.');
    const texto = motivo.trim().slice(0, 500);
    const atualizada = await stripe().subscriptions.update(c.stripe_assinatura_id!, {
      cancel_at_period_end: true,
      ...(texto ? { cancellation_details: { comment: texto } } : {}),
    });
    const em = instante(atualizada.cancel_at);
    await withTenant(tenantId, (db) =>
      db.query(`UPDATE tenants SET cancelar_no_fim = true, cancelar_em = $2, cancelamento_motivo = NULLIF($3, '') WHERE id = $1`, [tenantId, em, texto])
    );
    return em;
  });
}

export async function retomarAssinatura(user: SessionUser): Promise<void> {
  exigirAdmin(user);
  const tenantId = user.tenantId;
  await comStripe(async () => {
    const c = await withTenant(tenantId, (db) => carregarCobranca(db, tenantId));
    if (!c || !temAssinatura(c)) throw new UserError('Sua empresa não tem assinatura ativa.');
    await stripe().subscriptions.update(c.stripe_assinatura_id!, { cancel_at_period_end: false });
    await withTenant(tenantId, (db) =>
      db.query('UPDATE tenants SET cancelar_no_fim = false, cancelar_em = NULL, cancelamento_motivo = NULL WHERE id = $1', [tenantId])
    );
  });
}

/** Portal do Cliente do Stripe (trocar o cartão, recibos). Só faz sentido no cartão: o Portal não paga Pix. */
export async function abrirPortal(user: SessionUser, trocarCartao: boolean): Promise<string> {
  exigirAdmin(user);
  return comStripe(async () => {
    const c = await withTenant(user.tenantId, (db) => carregarCobranca(db, user.tenantId));
    if (!c?.stripe_customer_id) throw new UserError('Sua empresa ainda não tem assinatura.');
    const sessao = await stripe().billingPortal.sessions.create({
      customer: c.stripe_customer_id,
      locale: 'pt-BR',
      return_url: appUrl('/configuracoes/financeiro'),
      ...(trocarCartao && temAssinatura(c) ? { flow_data: { type: 'payment_method_update' as const } } : {}),
    });
    return sessao.url;
  });
}

// ---------------------------------------------------------------------------
// Pix de uma fatura (conta brasileira no Stripe: cada fatura é paga por um PaymentIntent Pix associado a ela)
// ---------------------------------------------------------------------------

export interface QrPix {
  status: string;
  valor?: number;
  imagem?: string;
  codigo?: string;
  expiraEm?: string | null;
}

async function faturaDaEmpresa(tenantId: string, faturaId: string): Promise<{ fatura: Stripe.Invoice; c: Cobranca }> {
  if (!/^in_[A-Za-z0-9]+$/.test(faturaId)) throw new UserError('Fatura inválida.');
  const c = await withTenant(tenantId, (db) => carregarCobranca(db, tenantId));
  const fatura = await stripe().invoices.retrieve(faturaId);
  if (!c?.stripe_customer_id || idDe(fatura.customer) !== c.stripe_customer_id) throw new UserError('Fatura não encontrada.');
  return { fatura, c };
}

const qrDe = (pi: Stripe.PaymentIntent): Omit<QrPix, 'status'> | null => {
  const qr = pi.next_action?.pix_display_qr_code;
  if (!qr) return null;
  return { imagem: qr.image_url_png ?? undefined, codigo: qr.data ?? undefined, expiraEm: qr.expires_at ? new Date(qr.expires_at * 1000).toISOString() : null };
};

/** Situação da fatura (a tela acompanha até "paid"). */
export async function situacaoDaFatura(user: SessionUser, faturaId: string): Promise<QrPix> {
  exigirAdmin(user);
  return comStripe(async () => {
    const { fatura } = await faturaDaEmpresa(user.tenantId, faturaId);
    if (fatura.status === 'paid') await sincronizarFatura(fatura).catch(() => undefined);
    return { status: fatura.status ?? 'open', valor: (fatura.amount_remaining ?? 0) / 100 };
  });
}

/** Cria (ou reaproveita, enquanto o QR vale) o Pix da fatura e devolve o QR Code. */
export async function pixDaFatura(user: SessionUser, faturaId: string): Promise<QrPix> {
  exigirAdmin(user);
  return comStripe(async () => {
    const s = stripe();
    const { fatura, c } = await faturaDaEmpresa(user.tenantId, faturaId);
    if (fatura.status === 'paid') return { status: 'paid' };
    if (fatura.status !== 'open') throw new UserError('Esta fatura não está mais disponível para pagamento.');

    const anterior = fatura.metadata?.banket_pix_pi;
    if (anterior) {
      const pi = await s.paymentIntents.retrieve(anterior);
      const qr = qrDe(pi);
      if (pi.status === 'succeeded') return { status: 'paid' };
      const vale = qr?.expiraEm ? new Date(qr.expiraEm).getTime() - Date.now() : 0;
      if (pi.status === 'requires_action' && qr && vale > 2 * 60_000) return { status: 'open', valor: fatura.amount_remaining / 100, ...qr };
      if (['requires_action', 'requires_payment_method', 'requires_confirmation'].includes(pi.status)) {
        await s.paymentIntents.cancel(pi.id).catch(() => undefined);
      }
    }

    const taxId = taxIdDoDocumento(c.documento);
    const pi = await s.paymentIntents.create({
      amount: fatura.amount_remaining,
      currency: 'brl',
      customer: c.stripe_customer_id!,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      payment_method_options: { pix: { expires_after_seconds: PIX_QR_SEGUNDOS } },
      description: `Banket · fatura ${fatura.number || fatura.id}`,
      metadata: { tenant_id: user.tenantId, invoice_id: fatura.id! },
    });
    await s.invoices.attachPayment(fatura.id!, { payment_intent: pi.id });
    const confirmado = await s.paymentIntents.confirm(pi.id, {
      payment_method_data: {
        type: 'pix',
        billing_details: {
          name: c.razao_social || c.nome,
          email: c.email ?? undefined,
          ...(taxId ? { tax_id: taxId.digitos } : {}),
          ...(enderecoStripe(c) ? { address: enderecoStripe(c) } : {}),
        },
      } as Stripe.PaymentIntentConfirmParams.PaymentMethodData,
    });
    await s.invoices.update(fatura.id!, { metadata: { ...fatura.metadata, banket_pix_pi: pi.id } });
    const qr = qrDe(confirmado);
    if (!qr) throw new UserError('Não foi possível gerar o QR Code Pix. Tente novamente.');
    return { status: 'open', valor: fatura.amount_remaining / 100, ...qr };
  });
}

// ---------------------------------------------------------------------------
// Espelho local do Stripe
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Empresa dona de um objeto do Stripe: metadata.tenant_id (conferida) ou o customer. */
export async function resolverTenant(obj: any): Promise<string | null> {
  const meta = obj?.metadata?.tenant_id || obj?.subscription_details?.metadata?.tenant_id || obj?.parent?.subscription_details?.metadata?.tenant_id;
  const cliente = idDe(obj?.customer);
  const { rows } = await systemQuery<{ id: string }>(
    `SELECT id FROM tenants WHERE ($1::uuid IS NOT NULL AND id = $1::uuid) OR ($2::text IS NOT NULL AND stripe_customer_id = $2)
      ORDER BY (id = $1::uuid) DESC NULLS LAST LIMIT 1`,
    [meta && UUID.test(meta) ? meta : null, cliente]
  );
  return rows[0]?.id ?? null;
}

export async function buscarAssinatura(id: string): Promise<Stripe.Subscription> {
  return stripe().subscriptions.retrieve(id, { expand: ['default_payment_method', 'items.data.price'] });
}

async function planoDoPreco(precoId: string | null | undefined, fallback: string | null): Promise<string | null> {
  if (!precoId) return fallback;
  const { rows } = await systemQuery<{ id: string }>(
    'SELECT id FROM planos WHERE stripe_price_mensal_id = $1 OR stripe_price_anual_id = $1 LIMIT 1',
    [precoId]
  );
  return rows[0]?.id ?? fallback;
}

/** Aplica a assinatura à empresa. tenants.plano_id NÃO é gravado aqui: só promoverPlano, depois da confirmação. */
export async function sincronizarAssinatura(sub: Stripe.Subscription): Promise<{ tenantId: string; planoId: string | null; ignorada: boolean } | null> {
  const tenantId = await resolverTenant(sub);
  if (!tenantId) return null;
  const item = sub.items?.data?.[0];
  const preco = item?.price;
  const planoId = await planoDoPreco(preco?.id, sub.metadata?.plano_id && UUID.test(sub.metadata.plano_id) ? sub.metadata.plano_id : null);
  const pix = sub.collection_method === 'send_invoice';
  const pm = typeof sub.default_payment_method === 'object' ? (sub.default_payment_method as Stripe.PaymentMethod | null) : null;
  const cartao = pm?.card;

  return withTenant(tenantId, async (db) => {
    const { rows } = await db.query<{ stripe_assinatura_id: string | null }>('SELECT stripe_assinatura_id FROM tenants WHERE id = $1', [tenantId]);
    // Assinatura encerrada que não é a atual (substituída, ou já tratada no rebaixamento): evento atrasado não regrava.
    if (ASSINATURA_ENCERRADA.has(sub.status) && rows[0]?.stripe_assinatura_id !== sub.id) return { tenantId, planoId, ignorada: true };
    await db.query(
      `UPDATE tenants SET
          stripe_customer_id = COALESCE(stripe_customer_id, $2), stripe_assinatura_id = $3, stripe_assinatura_status = $4,
          cobranca_intervalo = $5, forma_pagamento = $6, cartao_bandeira = $7, cartao_final = $8, cartao_validade = $9,
          periodo_fim = $10, cancelar_no_fim = $11, cancelar_em = $12, cancelamento_motivo = COALESCE($13, cancelamento_motivo)
        WHERE id = $1`,
      [
        tenantId, idDe(sub.customer), sub.id, sub.status, preco?.recurring?.interval === 'year' ? 'ano' : 'mes', pix ? 'pix' : 'cartao',
        pix ? null : cartao?.brand ?? null, pix ? null : cartao?.last4 ?? null,
        pix || !cartao ? null : `${String(cartao.exp_month).padStart(2, '0')}/${String(cartao.exp_year).slice(-2)}`,
        instante((item as { current_period_end?: number } | undefined)?.current_period_end), Boolean(sub.cancel_at_period_end),
        instante(sub.cancel_at), sub.cancellation_details?.comment || sub.cancellation_details?.feedback || null,
      ]
    );
    invalidar(tenantId);
    return { tenantId, planoId, ignorada: false };
  });
}

/** Upsert da fatura em assinatura_faturas. */
export async function sincronizarFatura(inv: Stripe.Invoice): Promise<{ tenantId: string } | null> {
  if (!inv?.id) return null;
  const tenantId = await resolverTenant(inv);
  if (!tenantId) return null;
  const assinaturaId = idDe((inv as any).parent?.subscription_details?.subscription) || idDe((inv as any).subscription);
  // Vencimento: Pix (send_invoice) usa due_date; no cartão, a data da cobrança (finalização).
  const ts = inv.due_date || inv.status_transitions?.finalized_at || null;
  const vencimento = ts ? emSaoPaulo(new Date(ts * 1000)).data : null;
  const linhaPreco = (inv.lines?.data?.[0] as any)?.pricing?.price_details?.price ?? (inv.lines?.data?.[0] as any)?.price?.id ?? null;
  const metaPlano = (inv as any).parent?.subscription_details?.metadata?.plano_id ?? null;
  const planoId = await planoDoPreco(typeof linhaPreco === 'string' ? linhaPreco : null, metaPlano && UUID.test(metaPlano) ? metaPlano : null);
  await withTenant(tenantId, (db) =>
    db.query(
      `INSERT INTO assinatura_faturas (tenant_id, stripe_id, assinatura_id, numero, status, valor, valor_restante, moeda, vencimento,
                                       pago_em, forma, motivo, cobranca, tentativas, periodo_inicio, periodo_fim, url_fatura, pdf_url, plano_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, upper($8), $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       ON CONFLICT (stripe_id) DO UPDATE SET
         assinatura_id = EXCLUDED.assinatura_id, numero = EXCLUDED.numero, status = EXCLUDED.status, valor = EXCLUDED.valor,
         valor_restante = EXCLUDED.valor_restante, vencimento = EXCLUDED.vencimento, pago_em = EXCLUDED.pago_em,
         forma = EXCLUDED.forma, motivo = EXCLUDED.motivo, cobranca = EXCLUDED.cobranca, tentativas = EXCLUDED.tentativas,
         periodo_inicio = EXCLUDED.periodo_inicio, periodo_fim = EXCLUDED.periodo_fim, url_fatura = EXCLUDED.url_fatura,
         pdf_url = EXCLUDED.pdf_url, plano_id = COALESCE(EXCLUDED.plano_id, assinatura_faturas.plano_id), updated_at = now()`,
      [
        tenantId, inv.id, assinaturaId, inv.number ?? null, inv.status ?? 'draft', (inv.total ?? inv.amount_due ?? 0) / 100,
        (inv.amount_remaining ?? 0) / 100, inv.currency || 'brl', vencimento, instante(inv.status_transitions?.paid_at),
        inv.collection_method === 'send_invoice' ? 'pix' : 'cartao', inv.billing_reason ?? null, inv.collection_method ?? null,
        inv.attempt_count ?? null, instante(inv.period_start), instante(inv.period_end), inv.hosted_invoice_url ?? null,
        inv.invoice_pdf ?? null, planoId,
      ]
    )
  );
  return { tenantId };
}

async function temFaturaAberta(tenantId: string, assinaturaId: string): Promise<boolean> {
  const { rows } = await systemQuery(
    `SELECT 1 FROM assinatura_faturas WHERE tenant_id = $1 AND assinatura_id = $2 AND status = 'open' AND valor > 0 LIMIT 1`,
    [tenantId, assinaturaId]
  );
  return rows.length > 0;
}

async function teveFaturaPaga(tenantId: string, assinaturaId: string, excetoFatura?: string): Promise<boolean> {
  const { rows } = await systemQuery(
    `SELECT 1 FROM assinatura_faturas WHERE tenant_id = $1 AND assinatura_id = $2 AND status = 'paid' AND valor > 0
        AND ($3::text IS NULL OR stripe_id <> $3) LIMIT 1`,
    [tenantId, assinaturaId, excetoFatura ?? null]
  );
  return rows.length > 0;
}

/**
 * Plano pago confirmado pelo Stripe: assinatura viva e (cartão → cobrança automática; Pix → fatura paga ou ainda em
 * teste no Stripe). Assinatura já cobrando (status active) encerra o teste do Banket. Devolve true se o plano mudou.
 */
export async function promoverPlano(tenantId: string, sub: Stripe.Subscription, planoId: string | null, inv: Stripe.Invoice | null = null): Promise<boolean> {
  if (!planoId || !['active', 'trialing', 'past_due'].includes(sub.status)) return false;
  if (sub.collection_method === 'send_invoice' && sub.status !== 'trialing') {
    // Pix: precisa de fatura paga e nenhuma em aberto (ex.: a diferença de uma subida de plano ainda não paga)
    const paga = (inv?.status === 'paid' && (inv.amount_paid ?? 0) > 0) || (await teveFaturaPaga(tenantId, sub.id));
    if (!paga || (await temFaturaAberta(tenantId, sub.id))) return false;
  }
  return withTenant(tenantId, async (db) => {
    const { rows } = await db.query<{ plano_id: string | null; gratuito: boolean | null }>(
      'SELECT t.plano_id, p.gratuito FROM tenants t LEFT JOIN planos p ON p.id = t.plano_id WHERE t.id = $1',
      [tenantId]
    );
    const encerraTeste = sub.status !== 'trialing';
    if (rows[0]?.plano_id === planoId) {
      await db.query(
        `UPDATE tenants SET plano_pendente_id = NULL, trial_ate = CASE WHEN $2 THEN NULL ELSE trial_ate END WHERE id = $1`,
        [tenantId, encerraTeste]
      );
      invalidar(tenantId);
      return false;
    }
    await trocarPlano(db, tenantId, planoId, {
      motivo: 'assinatura', origem: 'stripe', dados: { stripe_assinatura_id: sub.id, fatura: inv?.id ?? null }, manterTrial: !encerraTeste,
    });
    await registrarUpsell(db, { id: null, tenantId }, 'assinatura_concluida', null, { plano_id: planoId, de_gratuito: rows[0]?.gratuito === true });
    return true;
  });
}

/**
 * Cancela a assinatura na hora e anula as faturas abertas (rebaixamento ou contratação abandonada). Antes de anular,
 * cancela o Pix pendente da fatura (o QR deixa de ser pagável). Fatura que não pôde ser anulada aborta o
 * cancelamento: se ela foi paga nesse meio-tempo, quem pagou não perde o plano.
 */
async function encerrarNoStripe(assinaturaId: string): Promise<void> {
  if (!cobrancaConfigurada()) return;
  const s = stripe();
  for await (const inv of s.invoices.list({ subscription: assinaturaId, status: 'open', limit: 20 })) {
    const pix = inv.metadata?.banket_pix_pi;
    if (pix) {
      const pi = await s.paymentIntents.retrieve(pix).catch(() => null);
      if (pi?.status === 'succeeded') throw new Error(`fatura ${inv.id} com Pix pago: cancelamento abortado`);
      if (pi && ['requires_action', 'requires_payment_method', 'requires_confirmation'].includes(pi.status)) await s.paymentIntents.cancel(pi.id);
    }
    try {
      await sincronizarFatura(await s.invoices.voidInvoice(inv.id!));
    } catch (err) {
      const atual = await s.invoices.retrieve(inv.id!);
      await sincronizarFatura(atual);
      if (atual.status !== 'void') throw new Error(`fatura ${inv.id} não foi anulada (status ${atual.status}): cancelamento abortado`, { cause: err });
    }
  }
  const sub = await s.subscriptions
    .cancel(assinaturaId, { invoice_now: false, prorate: false })
    .catch((e) => (e?.code === 'resource_missing' ? null : Promise.reject(e)));
  if (sub) await sincronizarAssinatura(sub);
}

/** Tira a assinatura da empresa (fica só no histórico das faturas): a regra volta a ser a do teste/manual. */
async function soltarAssinatura(tenantId: string, assinaturaId: string): Promise<void> {
  await withTenant(tenantId, (db) =>
    db.query(
      `UPDATE tenants SET stripe_assinatura_id = NULL, stripe_assinatura_status = NULL, plano_pendente_id = NULL,
              cancelar_no_fim = false, cancelar_em = NULL, periodo_fim = NULL
        WHERE id = $1 AND stripe_assinatura_id = $2`,
      [tenantId, assinaturaId]
    )
  );
  invalidar(tenantId);
}

const MOTIVO_HISTORICO: Record<MotivoRebaixamento, 'trial_encerrado' | 'inadimplencia' | 'cancelamento'> = {
  trial_encerrado: 'trial_encerrado',
  inadimplencia: 'inadimplencia',
  cancelamento: 'cancelamento',
};

/**
 * Recalcula o estado da empresa e, se for o caso, rebaixa para o plano Busca: cancela no Stripe primeiro (assinatura
 * e faturas abertas), solta a assinatura e troca o plano (com excedentes e e-mail). Idempotente.
 */
/** Atualiza o espelho local com a assinatura e as faturas recentes direto do Stripe (e promove se já foi paga). */
async function atualizarDoStripe(assinaturaId: string): Promise<void> {
  const sub = await buscarAssinatura(assinaturaId);
  for await (const inv of stripe().invoices.list({ subscription: assinaturaId, limit: 10 })) await sincronizarFatura(inv);
  const sinc = await sincronizarAssinatura(sub);
  if (sinc && !sinc.ignorada) await promoverPlano(sinc.tenantId, sub, sinc.planoId);
}

export async function avaliarEmpresa(tenantId: string, origem: 'agendador' | 'stripe' | 'app' = 'agendador', agora = new Date()): Promise<EstadoCobranca | null> {
  let c = await withSystem((db) => carregarCobranca(db, tenantId));
  if (!c) return null;
  let { estado, motivo } = estadoDe(c, agora);
  if (estado !== 'rebaixar' || !motivo) return estado;
  // O espelho local pode estar atrasado (webhook atrasado ou perdido): antes de qualquer ação destrutiva, confere a
  // assinatura e as faturas no Stripe e decide de novo. Sem resposta do Stripe, tenta na próxima varredura.
  if (c.stripe_assinatura_id && cobrancaConfigurada()) {
    try {
      await atualizarDoStripe(c.stripe_assinatura_id);
    } catch (err) {
      console.error('[assinatura] rebaixamento adiado: Stripe não respondeu', tenantId, err);
      return estado;
    }
    c = await withSystem((db) => carregarCobranca(db, tenantId));
    if (!c) return null;
    ({ estado, motivo } = estadoDe(c, agora));
    if (estado !== 'rebaixar' || !motivo) return estado;
  }
  const assinatura = c.stripe_assinatura_id;
  if (assinatura) {
    if (temAssinatura(c)) {
      try {
        await encerrarNoStripe(assinatura);
      } catch (err) {
        // Assinatura que não pôde ser encerrada (ou fatura paga agora): não rebaixa enquanto ela pode estar cobrando
        console.error('[assinatura] rebaixamento adiado: falha ao cancelar no Stripe', tenantId, err);
        return estado;
      }
    }
    await soltarAssinatura(tenantId, assinatura);
  }
  const rebaixou = await withSystem((db) =>
    rebaixarParaBusca(db, tenantId, MOTIVO_HISTORICO[motivo], origem, assinatura ? { stripe_assinatura_id: assinatura } : {})
  );
  if (rebaixou && motivo !== 'trial_encerrado') {
    await avisar(tenantId, motivo === 'inadimplencia' ? 'rebaixada_inadimplencia' : 'rebaixada_cancelamento', `${assinatura ?? 'x'}`, { planoNome: c.plano_nome ?? '' });
  }
  return 'rebaixar';
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/** Registra o evento (idempotência). Devolve false se já foi processado. */
export async function registrarEventoStripe(evento: Stripe.Event): Promise<boolean> {
  return withSystem(async (db) => {
    const ins = await db.query(
      `INSERT INTO stripe_events (id, type, livemode, payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [evento.id, evento.type, Boolean(evento.livemode), JSON.stringify(evento)]
    );
    if (ins.rows[0]) return true;
    const { rows } = await db.query<{ processed_at: Date | null }>('SELECT processed_at FROM stripe_events WHERE id = $1', [evento.id]);
    return !rows[0]?.processed_at;
  });
}

export async function marcarEventoStripe(id: string, tenantId: string | null, erro: string | null): Promise<void> {
  await systemQuery(
    `UPDATE stripe_events SET processed_at = CASE WHEN $3::text IS NULL THEN now() ELSE processed_at END,
            error = $3, tenant_id = COALESCE($2, tenant_id) WHERE id = $1`,
    [id, tenantId, erro ? erro.slice(0, 500) : null]
  );
}

async function tratarFatura(evento: Stripe.Event): Promise<string | null> {
  if (evento.type === 'invoice.upcoming') return resolverTenant(evento.data.object);
  const s = stripe();
  const inv = await s.invoices.retrieve((evento.data.object as Stripe.Invoice).id!);
  const sinc = await sincronizarFatura(inv);
  if (!sinc) return null;
  const { tenantId } = sinc;
  const assinaturaId = idDe((inv as any).parent?.subscription_details?.subscription) || idDe((inv as any).subscription);
  let sub: Stripe.Subscription | null = null;
  let planoId: string | null = null;
  if (assinaturaId) {
    sub = await buscarAssinatura(assinaturaId);
    planoId = (await sincronizarAssinatura(sub))?.planoId ?? null;
  }
  if (evento.type === 'invoice.paid' && sub) await promoverPlano(tenantId, sub, planoId, inv);
  await avaliarEmpresa(tenantId, 'stripe');

  if (evento.type === 'invoice.paid' && (inv.amount_paid ?? 0) > 0) {
    // Cancela o Pix pendente da fatura (paga por outro meio ou QR antigo).
    const pendente = inv.metadata?.banket_pix_pi;
    if (pendente) {
      const pi = await s.paymentIntents.retrieve(pendente).catch(() => null);
      if (pi && ['requires_action', 'requires_payment_method', 'requires_confirmation'].includes(pi.status)) await s.paymentIntents.cancel(pi.id).catch(() => undefined);
    }
    if (assinaturaId && !(await teveFaturaPaga(tenantId, assinaturaId, inv.id))) {
      await avisar(tenantId, 'ativada', assinaturaId, { valor: inv.amount_paid / 100 });
    }
  } else if (evento.type === 'invoice.payment_failed' && inv.attempt_count === 1) {
    await avisar(tenantId, 'pagamento_falhou', inv.id!, { valor: inv.amount_due / 100 });
  } else if (evento.type === 'invoice.finalized' && inv.collection_method === 'send_invoice' && inv.amount_due > 0) {
    await avisar(tenantId, 'fatura_pix', inv.id!, { valor: inv.amount_due / 100, vencimento: inv.due_date ? emSaoPaulo(new Date(inv.due_date * 1000)).data : '', faturaId: inv.id! });
  }
  return tenantId;
}

async function tratarAssinatura(evento: Stripe.Event): Promise<string | null> {
  const sub = await buscarAssinatura((evento.data.object as Stripe.Subscription).id);
  const sinc = await sincronizarAssinatura(sub);
  if (!sinc) return null;
  const { tenantId, planoId, ignorada } = sinc;
  if (ignorada) return tenantId;
  await promoverPlano(tenantId, sub, planoId);

  if (evento.type === 'customer.subscription.updated') {
    const antes = (evento.data.previous_attributes ?? {}) as Partial<Stripe.Subscription>;
    if (antes.cancel_at_period_end === false && sub.cancel_at_period_end) {
      await avisar(tenantId, 'cancelamento_agendado', `${sub.id}:${sub.cancel_at}`, { fim: sub.cancel_at ? emSaoPaulo(new Date(sub.cancel_at * 1000)).data : '' });
    }
  }
  if (evento.type === 'customer.subscription.deleted' && !(await teveFaturaPaga(tenantId, sub.id))) {
    // Contratação que nunca foi paga (Pix abandonado, cartão recusado): volta à regra do teste, sem rebaixar.
    await soltarAssinatura(tenantId, sub.id);
  }
  await avaliarEmpresa(tenantId, 'stripe');
  return tenantId;
}

/**
 * Estorno total ou contestação de um pagamento da assinatura: a empresa volta ao plano Busca na hora (a assinatura é
 * encerrada no Stripe antes, para não cobrar de novo). Estorno parcial só fica no log, para a equipe avaliar.
 */
async function tratarEstorno(evento: Stripe.Event): Promise<string | null> {
  const s = stripe();
  const contestacao = evento.type === 'charge.dispute.created';
  const objeto = evento.data.object as Stripe.Dispute | Stripe.Charge;
  const charge = contestacao ? await s.charges.retrieve(idDe((objeto as Stripe.Dispute).charge)!) : await s.charges.retrieve((objeto as Stripe.Charge).id);
  const tenantId = await resolverTenant(charge);
  if (!tenantId) return null;
  if (!contestacao && !charge.refunded) {
    console.warn('[stripe] estorno parcial (sem rebaixar)', charge.id, tenantId, charge.amount_refunded / 100);
    return tenantId;
  }
  console.warn(`[stripe] ${contestacao ? 'CONTESTAÇÃO' : 'ESTORNO TOTAL'}: rebaixando`, charge.id, tenantId);
  const c = await withSystem((db) => carregarCobranca(db, tenantId));
  if (!c || c.gratuito) return tenantId;
  const assinatura = c.stripe_assinatura_id;
  if (assinatura) {
    // Sem encerrar no Stripe a cobrança seguiria; falhou → erro, e o Stripe reenvia o evento
    if (temAssinatura(c)) await encerrarNoStripe(assinatura);
    await soltarAssinatura(tenantId, assinatura);
  }
  const rebaixou = await withSystem((db) =>
    rebaixarParaBusca(db, tenantId, contestacao ? 'inadimplencia' : 'cancelamento', 'stripe', {
      stripe_assinatura_id: assinatura, charge: charge.id, motivo: contestacao ? 'contestacao' : 'estorno',
    })
  );
  if (rebaixou) await avisar(tenantId, 'rebaixada_estorno', charge.id, { planoNome: c.plano_nome ?? '' });
  return tenantId;
}

/** Processa um evento já verificado. Devolve a empresa (para o registro) ou null. */
export async function processarEventoStripe(evento: Stripe.Event): Promise<string | null> {
  const tipo = evento.type;
  if (tipo.startsWith('invoice.')) return tratarFatura(evento);
  if (tipo.startsWith('customer.subscription.')) return tratarAssinatura(evento);
  if (tipo === 'checkout.session.completed') {
    const sessao = evento.data.object as Stripe.Checkout.Session;
    const tenantId = sessao.client_reference_id && UUID.test(sessao.client_reference_id) ? await resolverTenant({ metadata: { tenant_id: sessao.client_reference_id } }) : await resolverTenant(sessao);
    if (tenantId && sessao.customer) {
      await withTenant(tenantId, (db) => db.query('UPDATE tenants SET stripe_customer_id = COALESCE(stripe_customer_id, $2) WHERE id = $1', [tenantId, idDe(sessao.customer)]));
    }
    if (sessao.subscription) {
      const sub = await buscarAssinatura(idDe(sessao.subscription)!);
      if (tenantId) {
        const { rows } = await systemQuery<{ stripe_assinatura_id: string | null; stripe_assinatura_status: string | null }>(
          'SELECT stripe_assinatura_id, stripe_assinatura_status FROM tenants WHERE id = $1',
          [tenantId]
        );
        const outra = rows[0];
        if (outra?.stripe_assinatura_id && outra.stripe_assinatura_id !== sub.id && ASSINATURA_VIVA.has(outra.stripe_assinatura_status ?? '')) {
          console.error('[stripe] ASSINATURA DUPLICADA: a empresa já tem', outra.stripe_assinatura_id, 'e concluiu o checkout de', sub.id, tenantId);
        }
      }
      const sinc = await sincronizarAssinatura(sub);
      if (sinc && !sinc.ignorada) await promoverPlano(sinc.tenantId, sub, sinc.planoId);
    }
    return tenantId;
  }
  if (tipo === 'customer.updated' || tipo === 'payment_method.attached') {
    const tenantId = await resolverTenant(evento.data.object);
    if (!tenantId) return null;
    const { rows } = await systemQuery<{ stripe_assinatura_id: string | null }>('SELECT stripe_assinatura_id FROM tenants WHERE id = $1', [tenantId]);
    if (rows[0]?.stripe_assinatura_id) await sincronizarAssinatura(await buscarAssinatura(rows[0].stripe_assinatura_id));
    return tenantId;
  }
  if (tipo === 'charge.dispute.created' || tipo === 'charge.refunded') return tratarEstorno(evento);
  return null;
}

// ---------------------------------------------------------------------------
// Agendador (server/agendador.ts): estados, contratação Pix abandonada e reconciliação
// ---------------------------------------------------------------------------

let ultimaReconciliacao = 0;

export async function varrerCobranca(agora = new Date()): Promise<{ rebaixadas: number; abandonadas: number; reconciliadas: number }> {
  let rebaixadas = 0;
  let abandonadas = 0;
  let reconciliadas = 0;

  // Contratação Pix cuja 1ª fatura não foi paga até as 12h de D+1 do vencimento: anula e cancela (a empresa volta
  // à regra do teste; uma nova contratação recria as duas).
  const { rows: pendentes } = await systemQuery<{ tenant_id: string; stripe_id: string; assinatura_id: string; vencimento: string }>(
    `SELECT f.tenant_id, f.stripe_id, f.assinatura_id, to_char(f.vencimento, 'YYYY-MM-DD') AS vencimento
       FROM assinatura_faturas f JOIN tenants t ON t.id = f.tenant_id
      WHERE f.status = 'open' AND f.motivo = 'subscription_create' AND f.cobranca = 'send_invoice'
        AND f.vencimento IS NOT NULL AND f.assinatura_id = t.stripe_assinatura_id`
  );
  for (const p of pendentes) {
    if (!passouDoPrazo(p.vencimento, agora) || !cobrancaConfigurada()) continue;
    try {
      // A fatura pode ter sido paga sem o webhook chegar: confere no Stripe antes de desfazer a contratação
      const atual = await stripe().invoices.retrieve(p.stripe_id);
      await sincronizarFatura(atual);
      if (atual.status !== 'open') {
        await atualizarDoStripe(p.assinatura_id);
        continue;
      }
      await encerrarNoStripe(p.assinatura_id);
      await soltarAssinatura(p.tenant_id, p.assinatura_id);
      abandonadas++;
    } catch (err) {
      console.error('[assinatura] contratação abandonada: falha na fatura', p.stripe_id, err);
    }
  }

  // Estados: fim do teste com contratação, fatura vencida, assinatura encerrada.
  const { rows } = await systemQuery<{ id: string }>(
    `SELECT t.id FROM tenants t JOIN planos p ON p.id = t.plano_id
      WHERE NOT p.gratuito AND t.status = 'active' AND t.stripe_assinatura_id IS NOT NULL`
  );
  for (const { id } of rows) {
    try {
      if ((await avaliarEmpresa(id, 'agendador', agora)) === 'rebaixar') rebaixadas++;
    } catch (err) {
      console.error('[assinatura] avaliação falhou para', id, err);
    }
  }

  // Reconciliação (eventos de webhook perdidos), a cada 6 h por processo.
  if (cobrancaConfigurada() && agora.getTime() - ultimaReconciliacao >= 6 * 3_600_000) {
    ultimaReconciliacao = agora.getTime();
    const { rows: comAssinatura } = await systemQuery<{ id: string; stripe_assinatura_id: string }>(
      'SELECT id, stripe_assinatura_id FROM tenants WHERE stripe_assinatura_id IS NOT NULL'
    );
    for (const t of comAssinatura) {
      try {
        const sub = await buscarAssinatura(t.stripe_assinatura_id).catch(() => null);
        if (sub) {
          const sinc = await sincronizarAssinatura(sub);
          if (sinc && !sinc.ignorada) await promoverPlano(sinc.tenantId, sub, sinc.planoId);
        }
        for await (const inv of stripe().invoices.list({ subscription: t.stripe_assinatura_id, limit: 10 })) await sincronizarFatura(inv);
        await avaliarEmpresa(t.id, 'agendador', agora);
        reconciliadas++;
      } catch (err) {
        console.error('[assinatura] reconciliação falhou para', t.id, err);
      }
    }
  }
  return { rebaixadas, abandonadas, reconciliadas };
}

// ---------------------------------------------------------------------------
// E-mails de cobrança (owner/admin), com dedup em plano_avisos
// ---------------------------------------------------------------------------

type Aviso = 'ativada' | 'pagamento_falhou' | 'fatura_pix' | 'cancelamento_agendado' | 'rebaixada_inadimplencia' | 'rebaixada_cancelamento' | 'rebaixada_estorno';
const CHAVE: Record<Aviso, string> = {
  ativada: 'at', pagamento_falhou: 'pf', fatura_pix: 'px', cancelamento_agendado: 'cn', rebaixada_inadimplencia: 'ri', rebaixada_cancelamento: 'rc',
  rebaixada_estorno: 're',
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');

async function avisar(tenantId: string, aviso: Aviso, ref: string, ctx: { valor?: number; vencimento?: string; faturaId?: string; fim?: string; planoNome?: string }): Promise<void> {
  try {
    await withSystem(async (db) => {
      const { rowCount } = await db.query('INSERT INTO plano_avisos (tenant_id, chave) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
        tenantId,
        `cob:${CHAVE[aviso]}:${ref}`.slice(0, 80),
      ]);
      if (!rowCount) return;
      const pessoas = await destinatarios(db, tenantId);
      if (!pessoas.length) return;
      const ent = await entitlements(tenantId, db);
      const empresa = pessoas[0].empresa;
      const plano = ctx.planoNome || ent?.planoNome || 'Banket';
      const faturamento = appUrl('/configuracoes/financeiro');
      const textos: Record<Aviso, { assunto: string; titulo: string; corpo: string[]; cta: { texto: string; url: string } }> = {
        ativada: {
          assunto: `Assinatura do plano ${plano} confirmada`,
          titulo: 'Assinatura confirmada',
          corpo: [`Recebemos o pagamento${ctx.valor ? ` de ${brl(ctx.valor)}` : ''} e a assinatura do plano ${plano} da ${empresa} está ativa. Obrigado por escolher o Banket!`],
          cta: { texto: 'Ver faturamento', url: faturamento },
        },
        pagamento_falhou: {
          assunto: 'Não conseguimos cobrar a sua assinatura',
          titulo: 'O pagamento não foi aprovado',
          corpo: [`A cobrança${ctx.valor ? ` de ${brl(ctx.valor)}` : ''} da assinatura da ${empresa} não foi aprovada. Atualize o cartão para evitar que a empresa volte ao plano Busca.`],
          cta: { texto: 'Atualizar pagamento', url: faturamento },
        },
        fatura_pix: {
          assunto: `Sua fatura do Banket${ctx.vencimento ? ` vence em ${dataBR(ctx.vencimento)}` : ''}`,
          titulo: 'Fatura disponível para pagamento',
          corpo: [`A fatura${ctx.valor ? ` de ${brl(ctx.valor)}` : ''} do plano ${plano} da ${empresa} está disponível${ctx.vencimento ? `, com vencimento em ${dataBR(ctx.vencimento)}` : ''}. Pague com Pix pelo link abaixo.`],
          cta: { texto: 'Pagar com Pix', url: ctx.faturaId ? appUrl(`/configuracoes/financeiro/pagar/${ctx.faturaId}`) : faturamento },
        },
        cancelamento_agendado: {
          assunto: 'Cancelamento da assinatura agendado',
          titulo: 'Cancelamento agendado',
          corpo: [
            `A assinatura do plano ${plano} da ${empresa} foi cancelada e o acesso continua até ${dataBR(ctx.fim) || 'o fim do período pago'}.`,
            'Depois disso a empresa volta ao plano Busca, sem perder nenhum dado. Mudou de ideia? Desfaça o cancelamento no faturamento.',
          ],
          cta: { texto: 'Ver faturamento', url: faturamento },
        },
        rebaixada_inadimplencia: {
          assunto: 'Sua empresa voltou ao plano Busca',
          titulo: 'A fatura não foi paga',
          corpo: [
            `Como a fatura do plano ${plano} não foi paga, a ${empresa} voltou ao plano Busca. Nada foi apagado: assine de novo para voltar a usar todos os módulos.`,
          ],
          cta: { texto: 'Assinar de novo', url: faturamento },
        },
        rebaixada_cancelamento: {
          assunto: 'Sua assinatura foi encerrada',
          titulo: 'Assinatura encerrada',
          corpo: [`A assinatura do plano ${plano} da ${empresa} foi encerrada e a empresa voltou ao plano Busca. Nada foi apagado: assine quando quiser voltar.`],
          cta: { texto: 'Ver planos', url: appUrl('/planos') },
        },
        rebaixada_estorno: {
          assunto: 'Sua assinatura foi encerrada',
          titulo: 'Pagamento estornado',
          corpo: [
            `O pagamento da assinatura do plano ${plano} da ${empresa} foi estornado ou contestado junto ao cartão, então a assinatura foi encerrada e a empresa voltou ao plano Busca.`,
            'Nada foi apagado. Se foi um engano, fale com a gente respondendo este e-mail ou assine de novo.',
          ],
          cta: { texto: 'Ver planos', url: appUrl('/planos') },
        },
      };
      const t = textos[aviso];
      for (const p of pessoas) {
        const { html, text } = emailLayout({
          titulo: t.titulo,
          paragrafos: [`Olá, ${p.nome.split(' ')[0]}!`, ...t.corpo],
          cta: t.cta,
          rodape: `Você recebeu esta mensagem porque é responsável pela conta da ${empresa} no Banket.`,
        });
        await sendMail({ to: p.email, subject: t.assunto, html, text });
      }
    });
  } catch (err) {
    console.error('[assinatura] e-mail de cobrança:', aviso, err);
  }
}

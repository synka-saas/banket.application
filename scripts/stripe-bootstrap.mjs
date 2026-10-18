#!/usr/bin/env node
// Configuração inicial do Stripe para o Banket (mesmo modelo do Yosp, api/scripts/stripe-bootstrap.mjs). Idempotente.
//
//   node scripts/stripe-bootstrap.mjs            # modo teste (recusa chave live)
//   node scripts/stripe-bootstrap.mjs --live     # produção (go-live)
//   node scripts/stripe-bootstrap.mjs --dry-run  # só mostra o que faria
//
// 1. Para cada plano pago com preço (NOT gratuito AND preco_mensal; inclui o Master, que não é público: a equipe cobra
//    por ele, e o checkout do app só aceita planos públicos): um Product e dois Prices em BRL (mensal e anual), com lookup_key banket_<slug>_mensal|anual. Grava stripe_product_id / stripe_price_mensal_id /
//    stripe_price_anual_id em planos. Preço mudou no banco → novo Price (preços são imutáveis no Stripe). O Product
//    leva a descrição do plano e a lista de recursos com os limites (marketing_features: Checkout e Portal).
// 2. Portal do Cliente: trocar o cartão, ver faturas, atualizar dados fiscais. Troca de plano e cancelamento ficam
//    no Banket (o Portal não conhece o Pix).
//
// Lê STRIPE_SECRET_KEY / STRIPE_API_VERSION / APP_URL do ambiente ou do .env. Grava no banco via psql no contêiner
// (banket-postgres-1; outro nome com BANKET_DB_CONTAINER).
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');

function env(nome) {
  if (process.env[nome]) return process.env[nome];
  const arquivo = `${ROOT}/.env`;
  if (!existsSync(arquivo)) return '';
  let valor = '';
  for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === nome && m[2].trim()) valor = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return valor;
}

const CONTAINER = env('BANKET_DB_CONTAINER') || 'banket-postgres-1';
const DB_USER = env('POSTGRES_USER') || 'banket_user';
const DB_NAME = env('POSTGRES_DB') || 'banket_db';

function psql(sql) {
  const r = spawnSync('docker', ['exec', '-i', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '\t'], {
    input: sql,
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(r.stderr || 'psql falhou');
  return r.stdout.trim();
}
const lit = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

const chave = env('STRIPE_SECRET_KEY');
if (!chave) {
  console.error('STRIPE_SECRET_KEY ausente no ambiente e no .env.');
  process.exit(2);
}
const versao = env('STRIPE_API_VERSION');
const stripe = new Stripe(chave, versao ? { apiVersion: versao } : {});

const saldo = await stripe.balance.retrieve();
if (saldo.livemode && !args.has('--live')) {
  console.error('A chave é de PRODUÇÃO. Use as chaves de teste, ou rode com --live no go-live.');
  process.exit(2);
}
console.log(`Stripe em modo ${saldo.livemode ? 'PRODUÇÃO' : 'teste'}${DRY ? ' (dry-run)' : ''}\n`);

const planos = psql(
  `SELECT id, slug, nome, coalesce(preco_mensal::text,''), coalesce(preco_anual::text,''), coalesce(stripe_product_id,''),
          coalesce(descricao,''), recursos::text
     FROM planos WHERE ativo AND NOT gratuito AND preco_mensal IS NOT NULL ORDER BY ordem;`
)
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [id, slug, nome, mensal, anual, produto, descricao, recursos] = l.split('\t');
    return {
      id, slug, nome, mensal: mensal ? Number(mensal) : null, anual: anual ? Number(anual) : null, produto: produto || null,
      descricao: descricao || null, recursos: recursos ? JSON.parse(recursos) : {},
    };
  });

const centavos = (v) => Math.round(Number(v) * 100);

// Recursos do plano com limite, na ordem em que aparecem no site (lib/planos/recursos.ts tem o catálogo completo).
// -1 = sem limite; 0 ou ausente = fora do plano (não entra na lista). Máximo de 15 itens no Stripe.
const LIMITES = [
  ['usuarios', 'usuário', 'usuários'],
  ['espacos_qtd', 'espaço', 'espaços'],
  ['templates_qtd', 'template de proposta', 'templates de proposta'],
  ['cardapios_opcoes', 'cardápio', 'cardápios'],
  ['formularios_qtd', 'formulário de captação', 'formulários de captação'],
  ['documento_modelos', 'modelo de contrato', 'modelos de contrato'],
  ['email_modelos', 'modelo de e-mail', 'modelos de e-mail'],
  ['estoque_itens', 'item de estoque', 'itens de estoque'],
  ['ia_analises_mes', 'análise de IA por mês', 'análises de IA por mês'],
  ['ia_fundos_mes', 'fundo de proposta por IA por mês', 'fundos de proposta por IA por mês'],
  ['busca_fotos', 'foto no perfil do Banket Busca', 'fotos no perfil do Banket Busca'],
  ['busca_tipos_evento', 'tipo de evento no Banket Busca', 'tipos de evento no Banket Busca'],
];
const milhar = (n) => n.toLocaleString('pt-BR');
function recursosDoPlano(recursos) {
  const lista = [recursos.busca_personalizado ? 'Banket Busca Personalizado' : 'Banket Busca Simples'];
  for (const [chave, um, varios] of LIMITES) {
    const v = recursos[chave];
    if (typeof v !== 'number' || v === 0) continue;
    const nomeCap = varios.charAt(0).toUpperCase() + varios.slice(1);
    lista.push(v < 0 ? `${nomeCap} sem limite` : `${milhar(v)} ${v === 1 ? um : varios}`);
  }
  return lista.slice(0, 15).map((name) => ({ name: name.slice(0, 80) }));
}

async function garantirPreco(produto, plano, intervalo, valor) {
  const lookup = `banket_${plano.slug}_${intervalo === 'year' ? 'anual' : 'mensal'}`;
  const existente = (await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 })).data[0];
  if (existente && existente.unit_amount === valor && existente.product === produto.id && existente.currency === 'brl') {
    console.log(`  = ${lookup}: R$ ${(valor / 100).toFixed(2)} (${existente.id})`);
    return existente.id;
  }
  if (DRY) {
    console.log(`  + criaria ${lookup}: R$ ${(valor / 100).toFixed(2)}`);
    return existente?.id ?? null;
  }
  const preco = await stripe.prices.create({
    product: produto.id,
    currency: 'brl',
    unit_amount: valor,
    recurring: { interval: intervalo },
    lookup_key: lookup,
    transfer_lookup_key: true,
    nickname: `${plano.nome} ${intervalo === 'year' ? 'anual' : 'mensal'}`,
    metadata: { plano_id: plano.id, plano_slug: plano.slug },
  });
  if (existente) await stripe.prices.update(existente.id, { active: false });
  console.log(`  + ${lookup}: R$ ${(valor / 100).toFixed(2)} (${preco.id})${existente ? ` — substitui ${existente.id}` : ''}`);
  return preco.id;
}

for (const plano of planos) {
  if (plano.mensal == null) {
    console.log(`- ${plano.slug}: sem preço mensal, ignorado`);
    continue;
  }
  console.log(`${plano.nome} (${plano.slug})`);
  const metadata = { plano_id: plano.id, plano_slug: plano.slug };
  let produto = plano.produto ? await stripe.products.retrieve(plano.produto).catch(() => null) : null;
  if (!produto) produto = (await stripe.products.search({ query: `metadata['plano_id']:'${plano.id}'` })).data[0] ?? null;
  if (!produto && !DRY) {
    produto = await stripe.products.create(
      { name: `Banket ${plano.nome}`, description: plano.descricao ?? undefined, marketing_features: recursosDoPlano(plano.recursos), metadata, tax_code: 'txcd_10103001' },
      { idempotencyKey: `banket-product-${plano.id}` }
    );
    console.log(`  + produto ${produto.id}`);
  } else if (produto && !DRY) {
    await stripe.products.update(produto.id, {
      name: `Banket ${plano.nome}`, description: plano.descricao ?? '', marketing_features: recursosDoPlano(plano.recursos), metadata,
    });
    console.log(`  = produto ${produto.id}`);
  }
  if (!produto) {
    console.log('  + criaria o produto');
    continue;
  }
  const mes = await garantirPreco(produto, plano, 'month', centavos(plano.mensal));
  const ano = plano.anual != null ? await garantirPreco(produto, plano, 'year', centavos(plano.anual)) : null;
  if (!DRY) {
    psql(`UPDATE planos SET stripe_product_id = ${lit(produto.id)}, stripe_price_mensal_id = ${lit(mes)}, stripe_price_anual_id = ${lit(ano)}, updated_at = now() WHERE id = ${lit(plano.id)};`);
  }
}

// Portal do Cliente (configuração padrão da conta Stripe).
const appUrl = (env('APP_URL') || 'https://app.banket.com.br').replace(/\/$/, '');
const portal = {
  features: {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ['email', 'address', 'tax_id'] },
    subscription_cancel: { enabled: false },
    subscription_update: { enabled: false },
  },
  default_return_url: `${appUrl}/configuracoes/financeiro`,
  business_profile: {
    headline: 'Banket: gerencie sua assinatura',
    privacy_policy_url: `${appUrl}/privacidade`,
    terms_of_service_url: `${appUrl}/termos`,
  },
};
const configs = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
if (DRY) {
  console.log(`\nPortal do Cliente: ${configs.data[0] ? `atualizaria ${configs.data[0].id}` : 'criaria a configuração padrão'}`);
} else if (configs.data[0]) {
  await stripe.billingPortal.configurations.update(configs.data[0].id, portal);
  console.log(`\nPortal do Cliente: configuração padrão ${configs.data[0].id} atualizada`);
} else {
  const c = await stripe.billingPortal.configurations.create(portal);
  console.log(`\nPortal do Cliente: configuração ${c.id} criada`);
}
console.log('\nPronto. Webhook: https://app.banket.com.br/api/webhooks/stripe (eventos invoice.*, customer.subscription.*,');
console.log('checkout.session.completed, customer.updated, payment_method.attached, charge.dispute.created).');

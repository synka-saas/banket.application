// Cliente do Stripe (cobrança da assinatura do Banket; mesmo modelo do Yosp, platform/src/lib/stripe.js).
//   - Customer criado na 1ª contratação (não no cadastro), com metadata.tenant_id e CPF/CNPJ (br_cpf/br_cnpj).
//   - Cartão: Checkout hospedado (mode=subscription). O Banket nunca vê o número do cartão.
//   - Pix: assinatura com collection_method=send_invoice e 7 dias para pagar; cada fatura é paga por um
//     PaymentIntent Pix associado a ela (página /configuracoes/financeiro/pagar/[id]).
//   - O espelho local (tenants.stripe_*, assinatura_faturas) é mantido pelo webhook (server/assinatura.ts).
import Stripe from 'stripe';
import { UserError } from './forms';

let cliente: Stripe | null = null;

const env = (nome: string): string | undefined => process.env[nome] ?? (import.meta.env as Record<string, string | undefined>)[nome];

/**
 * Ambiente do Stripe: STRIPE_AMBIENTE=prod usa STRIPE_SECRET_KEY_PROD / STRIPE_WEBHOOK_SECRET_PROD; qualquer outro valor
 * (ou vazio) usa as _DEV (sandbox). STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET, se definidas, têm prioridade (legado).
 */
export const ambienteStripe = (): 'PROD' | 'DEV' => (env('STRIPE_AMBIENTE')?.trim().toLowerCase() === 'prod' ? 'PROD' : 'DEV');
const chaveSecreta = (): string | undefined => env('STRIPE_SECRET_KEY') || env(`STRIPE_SECRET_KEY_${ambienteStripe()}`);

/** Há chave do Stripe? Sem ela, "Assinar" vira "Falar com a equipe". */
export const cobrancaConfigurada = (): boolean => Boolean(chaveSecreta());

export function stripe(): Stripe {
  if (cliente) return cliente;
  const chave = chaveSecreta();
  if (!chave) throw new UserError('A contratação pelo app ainda não está disponível. Fale com a equipe do Banket.');
  const versao = env('STRIPE_API_VERSION');
  cliente = new Stripe(chave, {
    ...(versao ? { apiVersion: versao as Stripe.LatestApiVersion } : {}),
    maxNetworkRetries: 2,
    appInfo: { name: 'banket-app' },
  });
  return cliente;
}

export const webhookSecret = (): string | undefined => env('STRIPE_WEBHOOK_SECRET') || env(`STRIPE_WEBHOOK_SECRET_${ambienteStripe()}`);

export const PIX_DIAS_PARA_PAGAR = 7;
export const PIX_QR_SEGUNDOS = Number(env('STRIPE_PIX_EXPIRES_SECONDS')) || 24 * 60 * 60;

/** id de um campo expansível do Stripe (string ou objeto). */
export const idDe = (v: unknown): string | null =>
  typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: unknown }).id) : null;

/** Instante de um timestamp do Stripe (segundos). */
export const instante = (s: number | null | undefined): Date | null => (s ? new Date(s * 1000) : null);

/** Erro do Stripe → mensagem para o usuário (erro de cartão vem do próprio Stripe; o resto é genérico e vai ao log). */
export function erroStripe(err: unknown): Error {
  if (err instanceof UserError) return err;
  const e = err as { type?: string; code?: string; message?: string };
  if (e?.type?.startsWith('Stripe')) {
    console.error('[stripe]', e.type, e.code, e.message);
    return new UserError(e.type === 'StripeCardError' && e.message ? e.message : 'Não foi possível concluir a operação com o meio de pagamento. Tente novamente.');
  }
  return err as Error;
}

/** Executa uma chamada ao Stripe convertendo os erros. */
export async function comStripe<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw erroStripe(err);
  }
}

// Estado de cobrança da empresa (função pura, sem banco), no modelo do Yosp (billing-rules.js) adaptado ao Banket:
// em vez de pausar ou suspender, o fim do teste, a fatura vencida e a assinatura encerrada REBAIXAM a empresa para o
// plano Busca (server/planos.ts). Prazos sempre às 12h (São Paulo) do dia seguinte (D+1), como o teste.
//
//   gratuito → plano Busca: nunca teste, cobrança ou rebaixamento
//   trial    → teste do Banket vigente (sem assinatura) ou assinatura do Stripe ainda em teste
//   ativa    → assinatura em dia
//   vencida  → fatura venceu (D0 passou), antes das 12h de D+1: tudo liberado, aviso na tela
//   rebaixar → teste acabou sem assinatura, fatura vencida depois das 12h de D+1, ou assinatura encerrada/incobrável
//   manual   → plano pago sem teste nem assinatura (Manager Hwesta, backoffice, empresas anteriores aos planos)
import { HORA_REBAIXAMENTO, deveRebaixar, emSaoPaulo, somarDias } from './trial';

export type EstadoCobranca = 'gratuito' | 'trial' | 'ativa' | 'vencida' | 'rebaixar' | 'manual';
export type MotivoRebaixamento = 'trial_encerrado' | 'inadimplencia' | 'cancelamento';

export interface DadosCobranca {
  gratuito: boolean;
  semPlano?: boolean;
  /** Último dia do teste (YYYY-MM-DD) */
  trialAte: string | null;
  assinaturaId: string | null;
  assinaturaStatus: string | null;
  /** Fatura em aberto mais antiga da assinatura atual */
  faturaAberta?: { vencimento: string | null; motivo: string | null } | null;
  /** A assinatura atual já teve alguma fatura paga com valor? (ausente = sim, para quem não informa) */
  teveFaturaPaga?: boolean;
}

/** Status do Stripe em que a assinatura terminou (não volta). */
export const ASSINATURA_ENCERRADA = new Set(['canceled', 'incomplete_expired']);
/** Status em que a assinatura existe e cobra (unpaid = retentativas esgotadas). */
export const ASSINATURA_VIVA = new Set(['active', 'trialing', 'past_due', 'unpaid']);

/** A fatura venceu e já passou das 12h de D+1? */
export const passouDoPrazo = (vencimento: string, agora: Date): boolean => deveRebaixar(vencimento, agora);

/** A fatura venceu (já é o dia seguinte ao vencimento)? */
export function venceu(vencimento: string, agora: Date): boolean {
  return emSaoPaulo(agora).data > vencimento;
}

export function estadoCobranca(d: DadosCobranca, agora = new Date()): { estado: EstadoCobranca; motivo?: MotivoRebaixamento } {
  if (d.semPlano) return { estado: 'manual' };
  if (d.gratuito) return { estado: 'gratuito' };

  const status = d.assinaturaStatus ?? '';
  // 1ª fatura ainda em aberto: a contratação não se concretizou (no Pix a assinatura nasce "active" no Stripe antes
  // do pagamento), então vale a regra do teste, como se não houvesse assinatura. Vale também para a primeira fatura
  // cobrada no fim do teste ("subscription_cycle"): sem nenhuma fatura paga, a assinatura ainda não pagou nada.
  const nuncaPagou = d.teveFaturaPaga === false;
  const primeiraEmAberto = d.faturaAberta?.motivo === 'subscription_create' || (Boolean(d.faturaAberta) && nuncaPagou);
  const viva = Boolean(d.assinaturaId) && ASSINATURA_VIVA.has(status) && !primeiraEmAberto;

  if (viva) {
    if (status === 'unpaid') return { estado: 'rebaixar', motivo: 'inadimplencia' };
    const venc = d.faturaAberta?.vencimento;
    if (venc) {
      if (passouDoPrazo(venc, agora)) return { estado: 'rebaixar', motivo: 'inadimplencia' };
      if (venceu(venc, agora)) return { estado: 'vencida' };
    }
    return { estado: status === 'trialing' ? 'trial' : 'ativa' };
  }

  // Assinatura encerrada sem nunca ter pago (contratação desfeita): segue a regra do teste, não rebaixa por cancelamento
  if (d.assinaturaId && ASSINATURA_ENCERRADA.has(status) && !primeiraEmAberto && !nuncaPagou) {
    return { estado: 'rebaixar', motivo: 'cancelamento' };
  }

  if (d.trialAte) {
    return deveRebaixar(d.trialAte, agora) ? { estado: 'rebaixar', motivo: 'trial_encerrado' } : { estado: 'trial' };
  }
  return { estado: 'manual' };
}

/** Instante (UTC) do rebaixamento de uma data: 12h de São Paulo do dia seguinte. São Paulo não tem horário de verão. */
export function prazoDoDia(dataIso: string): Date {
  const [a, m, d] = somarDias(dataIso, 1).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, HORA_REBAIXAMENTO + 3, 0));
}

/** Fim do teste no Stripe (trial_end): 00:00 de São Paulo do dia seguinte ao último dia. */
export function fimDoTesteNoStripe(trialAte: string): Date {
  const [a, m, d] = somarDias(trialAte, 1).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d, 3, 0));
}

/** O Checkout do Stripe só aceita trial_end com pelo menos 48 h de antecedência (margem de 1 h). */
export const ANTECEDENCIA_MINIMA_CHECKOUT_MS = 49 * 60 * 60 * 1000;

export type Ciclo = 'mes' | 'ano';
export type Forma = 'cartao' | 'pix';

/** Valor do plano no ciclo (anual = preço do ano). */
export function valorDoCiclo(plano: { preco_mensal: number | null; preco_anual: number | null }, ciclo: Ciclo): number | null {
  const v = ciclo === 'ano' ? plano.preco_anual : plano.preco_mensal;
  return v == null ? null : Number(v);
}

/** CPF/CNPJ no formato do Stripe (br_cpf / br_cnpj). */
export function taxIdDoDocumento(documento: string | null | undefined): { type: 'br_cpf' | 'br_cnpj'; value: string; digitos: string } | null {
  const d = String(documento ?? '').replace(/\D/g, '');
  if (d.length === 11) return { type: 'br_cpf', value: d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'), digitos: d };
  if (d.length === 14) return { type: 'br_cnpj', value: d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'), digitos: d };
  return null;
}

/** Rótulos para a interface. */
export const ROTULO_ESTADO: Record<EstadoCobranca, string> = {
  gratuito: 'Gratuito',
  trial: 'Em teste',
  ativa: 'Ativa',
  vencida: 'Fatura vencida',
  rebaixar: 'Encerrada',
  manual: 'Ativa',
};

export const ROTULO_FATURA: Record<string, string> = {
  paid: 'Paga',
  open: 'Em aberto',
  void: 'Cancelada',
  uncollectible: 'Não paga',
  draft: 'Em preparação',
};

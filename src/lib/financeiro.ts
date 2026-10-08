// Gestão financeira: rótulos, situação da conta e geração das parcelas do plano de pagamento (puro: servidor e navegador).
import { somarMeses } from './datas';

export type TipoConta = 'receber' | 'pagar';
export type StatusConta = 'aberta' | 'paga' | 'cancelada';
/** Situação exibida: "vencida" é uma conta aberta com vencimento antes de hoje. */
export type SituacaoConta = StatusConta | 'vencida';

export const TIPOS_CONTA: Record<TipoConta, string> = { receber: 'A receber', pagar: 'A pagar' };

export const FORMAS_PAGAMENTO = {
  pix: 'Pix',
  boleto: 'Boleto',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
  outro: 'Outro',
} as const;
export type FormaPagamento = keyof typeof FORMAS_PAGAMENTO;

export const SITUACOES: Record<SituacaoConta, string> = {
  aberta: 'Em aberto',
  vencida: 'Vencida',
  paga: 'Paga',
  cancelada: 'Cancelada',
};

/** Rótulo da baixa conforme o tipo: "Recebida" / "Paga". */
export const rotuloSituacao = (tipo: TipoConta, s: SituacaoConta) => (s === 'paga' && tipo === 'receber' ? 'Recebida' : SITUACOES[s]);

export function situacaoConta(status: StatusConta, vencimento: string, hoje: string): SituacaoConta {
  return status === 'aberta' && vencimento < hoje ? 'vencida' : status;
}

export const centavos = (v: number) => Math.round(v * 100) / 100;

export interface PlanoPagamento {
  valor_total: number;
  /** Entrada/sinal (opcional) */
  entrada_valor: number | null;
  entrada_vencimento: string | null;
  /** Número de parcelas do saldo (0 quando a entrada quita tudo) */
  parcelas: number;
  primeiro_vencimento: string | null;
  intervalo_meses: number;
}

export interface ParcelaGerada {
  /** 0 = entrada; 1..total */
  parcela: number;
  parcelas: number;
  valor: number;
  vencimento: string;
}

/** Rótulo da parcela: "Entrada", "Parcela única", "Parcela 2/4". */
export function rotuloParcela(parcela: number | null, parcelas: number | null): string {
  if (parcela === null || parcelas === null) return '';
  if (parcela === 0) return 'Entrada';
  return parcelas === 1 ? 'Parcela única' : `Parcela ${parcela}/${parcelas}`;
}

/**
 * Parcelas do plano: entrada (se houver) e o saldo dividido em parcelas iguais a cada `intervalo_meses`;
 * os centavos que sobram da divisão vão para a última parcela. Lança Error com a mensagem para o usuário.
 */
export function gerarParcelas(p: PlanoPagamento): ParcelaGerada[] {
  const total = centavos(p.valor_total);
  if (!(total > 0)) throw new Error('Informe o valor total.');
  const entrada = p.entrada_valor ? centavos(p.entrada_valor) : 0;
  if (entrada < 0 || entrada > total) throw new Error('A entrada não pode ser maior que o valor total.');
  if (entrada > 0 && !p.entrada_vencimento) throw new Error('Informe o vencimento da entrada.');
  const saldo = centavos(total - entrada);
  const n = saldo > 0 ? p.parcelas : 0;
  if (saldo > 0 && (!Number.isInteger(n) || n < 1 || n > 60)) throw new Error('Informe de 1 a 60 parcelas para o saldo.');
  if (n > 0 && !p.primeiro_vencimento) throw new Error('Informe o vencimento da primeira parcela.');
  const intervalo = Math.max(1, Math.min(12, Math.trunc(p.intervalo_meses || 1)));

  const lista: ParcelaGerada[] = [];
  if (entrada > 0) lista.push({ parcela: 0, parcelas: Math.max(n, 1), valor: entrada, vencimento: p.entrada_vencimento! });
  const base = Math.floor((saldo / n) * 100) / 100;
  for (let i = 1; i <= n; i++) {
    const valor = i === n ? centavos(saldo - base * (n - 1)) : base;
    lista.push({ parcela: i, parcelas: n, valor, vencimento: somarMeses(p.primeiro_vencimento!, (i - 1) * intervalo) });
  }
  return lista;
}

/** Motivos de movimentação de estoque que podem gerar conta: compra → a pagar; devolução ao fornecedor → a receber. */
export const TIPO_CONTA_DO_MOTIVO: Record<string, TipoConta> = {
  compra: 'pagar',
  devolucao_fornecedor: 'receber',
};

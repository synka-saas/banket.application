// Regras puras do teste grátis (fase 1 do Banket Busca). Datas "YYYY-MM-DD" no fuso de São Paulo.
// O rebaixamento acontece às 12h do dia seguinte ao último dia do teste (D+1 12h), como no padrão Hwesta.

export const TRIAL_DIAS_PADRAO = 30;
/** Hora (SP) a partir da qual uma empresa com trial vencido é rebaixada, no dia seguinte ao fim. */
export const HORA_REBAIXAMENTO = 12;
/** Hora (SP) dos avisos D-7, D-1 e D0. */
export const HORA_AVISOS = 9;

/** Partes de um instante no fuso de São Paulo. */
export function emSaoPaulo(agora: Date): { data: string; hora: number } {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(agora);
  const pega = (t: string) => partes.find((p) => p.type === t)?.value ?? '00';
  return { data: `${pega('year')}-${pega('month')}-${pega('day')}`, hora: Number(pega('hour')) % 24 };
}

/** Soma dias a uma data "YYYY-MM-DD" (sem fuso). */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Diferença em dias (b − a) entre duas datas "YYYY-MM-DD". */
export function diferencaDias(a: string, b: string): number {
  const [aa, am, ad] = a.split('-').map(Number);
  const [ba, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ba, bm - 1, bd) - Date.UTC(aa, am - 1, ad)) / 86_400_000);
}

/** Último dia do teste a partir de hoje. */
export const fimDoTrial = (hoje: string, dias = TRIAL_DIAS_PADRAO): string => somarDias(hoje, dias);

/** Dias restantes do teste (0 no último dia; negativo depois). */
export const diasRestantes = (trialAte: string, hoje: string): number => diferencaDias(hoje, trialAte);

/**
 * Deve rebaixar? Só depois das 12h (SP) do dia seguinte ao último dia do teste.
 * Ex.: trial_ate = 2026-10-15 → rebaixa a partir de 2026-10-16 12:00.
 */
export function deveRebaixar(trialAte: string, agora: Date): boolean {
  const { data, hora } = emSaoPaulo(agora);
  const limite = somarDias(trialAte, 1);
  if (data > limite) return true;
  return data === limite && hora >= HORA_REBAIXAMENTO;
}

export type AvisoTrial = 'd7' | 'd1' | 'd0';

/**
 * Qual aviso cabe agora (um por dia, a partir das 9h SP): D-7, D-1 ou D0 (último dia).
 * Chave de dedup sugerida: `trial:${trialAte}:${aviso}`.
 */
export function avisoDoDia(trialAte: string, agora: Date): AvisoTrial | null {
  const { data, hora } = emSaoPaulo(agora);
  if (hora < HORA_AVISOS) return null;
  const restam = diasRestantes(trialAte, data);
  if (restam === 7) return 'd7';
  if (restam === 1) return 'd1';
  if (restam === 0) return 'd0';
  return null;
}

/** "Não tenho interesse" vale por 30 dias; depois a oferta de teste volta. */
export function recusaVigente(recusadoEm: Date | string | null | undefined, agora: Date): boolean {
  if (!recusadoEm) return false;
  const t = new Date(recusadoEm).getTime();
  return Number.isFinite(t) && agora.getTime() - t < 30 * 86_400_000;
}

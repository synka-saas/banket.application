// Tempo de resposta da empresa (Configurações › Empresa › Parâmetros comerciais): opções, texto do perfil no Busca e o
// momento do aviso "prazo vencendo" no WhatsApp. Puro (navegador e servidor).

export const TEMPOS_RESPOSTA = [2, 4, 6, 12, 24, 48, 72] as const;
export type TempoResposta = (typeof TEMPOS_RESPOSTA)[number];
export const TEMPO_RESPOSTA_PADRAO: TempoResposta = 48;

export const tempoRespostaValido = (h: unknown): h is TempoResposta => TEMPOS_RESPOSTA.includes(h as TempoResposta);

export const rotuloTempo = (h: number) => `${h} horas`;

/** Texto do perfil público ("Responde em até 48 horas"). */
export const textoTempoResposta = (h: number) => `Responde em até ${rotuloTempo(h)}`;

/**
 * Horas depois do pedido em que sai o aviso "prazo vencendo": quando restam 25% do prazo, só para prazos acima de
 * 12 horas (nos prazos curtos o aviso do pedido novo já basta). null = sem aviso.
 */
export function horasAteAvisoDePrazo(h: number): number | null {
  return h > 12 ? h * 0.75 : null;
}

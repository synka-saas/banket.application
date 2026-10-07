// Motivos das movimentações de estoque e os campos que cada um exige (puro: servidor e formulário).
// Rastreabilidade operacional e base do CMV: saídas guardam o custo médio; consumo e degustação ficam ligados ao evento.

export type TipoMovimento = 'entrada' | 'saida' | 'ajuste';
type Exigencia = 'obrigatorio' | 'opcional' | null;

export interface Razao {
  tipo: TipoMovimento;
  rotulo: string;
  descricao: string;
  evento: Exigencia;
  espaco: Exigencia;
  fornecedor: Exigencia;
  documento: Exigencia;
  /** Observação/justificativa */
  justificativa: Exigencia;
  /** Pede o custo unitário (e recalcula o custo médio) */
  custo: boolean;
}

const r = (tipo: TipoMovimento, rotulo: string, descricao: string, extra: Partial<Razao> = {}): Razao => ({
  tipo, rotulo, descricao, evento: null, espaco: null, fornecedor: null, documento: null, justificativa: 'opcional', custo: false, ...extra,
});

export const RAZOES = {
  // Entradas
  compra: r('entrada', 'Compra / nota fiscal de fornecedor', 'Aquisição de insumos; recalcula o custo médio.', { fornecedor: 'obrigatorio', documento: 'obrigatorio', custo: true }),
  devolucao_evento: r('entrada', 'Devolução / retorno de evento', 'Sobras não consumidas ou itens lacrados que voltam do evento.', { evento: 'obrigatorio' }),
  ajuste_sobra: r('entrada', 'Ajuste de inventário (sobra)', 'Contagem física acima do saldo do sistema.', { justificativa: 'obrigatorio' }),
  producao_interna: r('entrada', 'Produção interna / pré-preparo', 'Subitens feitos na cozinha (bases, massas, caldas).', { custo: true }),
  transferencia_entrada: r('entrada', 'Transferência entre espaços (entrada)', 'Carga recebida de outro salão, cozinha ou depósito.', { espaco: 'obrigatorio' }),
  bonificacao: r('entrada', 'Bonificação / amostra de fornecedor', 'Recebimento gratuito: entra no estoque sem mudar o custo médio.', { fornecedor: 'opcional' }),
  // Saídas
  consumo_evento: r('saida', 'Consumo em evento', 'Baixa para a execução de um evento (custo real × orçado).', { evento: 'obrigatorio' }),
  degustacao: r('saida', 'Degustação comercial', 'Prova de cardápio com clientes em negociação.', { evento: 'obrigatorio' }),
  perda: r('saida', 'Perda / vencimento / descarte', 'Perecíveis estragados, vencidos, avariados ou queimados.', { justificativa: 'obrigatorio' }),
  quebra: r('saida', 'Quebra / avaria', 'Vidros, garrafas e louças quebrados no serviço, transporte ou montagem.', { justificativa: 'obrigatorio', evento: 'opcional' }),
  consumo_interno: r('saida', 'Consumo interno / alimentação da equipe', 'Refeições do staff, fora do cardápio vendido.', { evento: 'opcional' }),
  ajuste_falta: r('saida', 'Ajuste de inventário (falta)', 'Contagem física abaixo do saldo do sistema.', { justificativa: 'obrigatorio' }),
  transferencia_saida: r('saida', 'Transferência entre espaços (saída)', 'Envio da base central para um espaço próprio ou parceiro.', { espaco: 'obrigatorio', evento: 'opcional' }),
  devolucao_fornecedor: r('saida', 'Devolução ao fornecedor', 'Produtos avariados, fora da especificação ou com validade inadequada.', { fornecedor: 'obrigatorio', documento: 'opcional', justificativa: 'obrigatorio' }),
  // Contagem
  contagem: r('ajuste', 'Contagem física (inventário)', 'Informa a quantidade contada; o sistema registra a diferença.'),
} as const satisfies Record<string, Razao>;

export type CodigoRazao = keyof typeof RAZOES;

export const TIPOS_MOVIMENTO: Record<TipoMovimento, string> = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Contagem' };

export const razoesDoTipo = (tipo: TipoMovimento) =>
  (Object.entries(RAZOES) as [CodigoRazao, Razao][]).filter(([, v]) => v.tipo === tipo);

export const ehRazao = (v: unknown): v is CodigoRazao => typeof v === 'string' && v in RAZOES;

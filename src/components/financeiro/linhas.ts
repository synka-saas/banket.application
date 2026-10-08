// Células das tabelas de contas (menu Financeiro e aba Finanças do evento), montadas com html`` (escapado).
import { html } from '../../lib/html';
import { formatMoney, moneyInput } from '../../lib/money';
import { dataCurta } from '../../lib/datas';
import { FORMAS_PAGAMENTO, rotuloParcela, rotuloSituacao, type SituacaoConta } from '../../lib/financeiro';
import type { Conta } from '../../server/financeiro';

const BADGE: Record<SituacaoConta, string> = { aberta: 'badge badge-info', vencida: 'badge badge-danger', paga: 'badge badge-success', cancelada: 'badge' };

const apoio = (c: Conta, mostrarEvento: boolean) => {
  const partes = [c.categoria_nome, rotuloParcela(c.parcela, c.parcelas), c.tipo === 'receber' ? (c.fornecedor ?? c.cliente_nome) : c.fornecedor, c.documento ? `Doc. ${c.documento}` : null]
    .filter(Boolean)
    .join(' · ');
  const evento = mostrarEvento && c.evento_id ? html`<a class="link" href="/eventos/${c.evento_id}/financas">${c.evento_titulo ?? 'Evento'}</a>${partes ? ' · ' : ''}` : '';
  return evento || partes ? html`<span class="fin-apoio">${evento}${partes}</span>` : '';
};

const origem = (c: Conta) =>
  c.origem === 'estoque' ? html` <span class="tag tag-sm tag-ochre">Estoque</span>` : c.origem === 'plano' ? html` <span class="tag tag-sm tag-cobalt">Plano</span>` : '';

export function valoresDaConta(c: Conta) {
  return JSON.stringify({
    id: c.id,
    descricao: c.descricao,
    valor: moneyInput(Number(c.valor)),
    vencimento: c.vencimento,
    categoria_id: c.categoria_id ?? '',
    evento_id: c.evento_id ?? '',
    forma_pagamento: c.forma_pagamento ?? '',
    fornecedor: c.fornecedor ?? '',
    documento: c.documento ?? '',
    observacoes: c.observacoes ?? '',
  });
}

function acoes(c: Conta) {
  const editar = html`<button type="button" class="row-action" data-drawer-open="drawer-conta-${c.tipo}" data-values="${valoresDaConta(c)}">Editar</button>`;
  const form = (acao: string, rotulo: string, pergunta: string, texto: string) =>
    html`<form method="post" class="inline-form"><input type="hidden" name="_action" value="${acao}" /><input type="hidden" name="conta_id" value="${c.id}" /><button type="submit" class="row-action${acao === 'cancelar' ? ' perigo' : ''}" data-confirm="${pergunta}" data-confirm-texto="${texto}" data-confirm-rotulo="${rotulo}">${rotulo}</button></form>`;
  if (c.status === 'aberta') {
    const baixa = JSON.stringify({ conta_id: c.id, valor_pago: moneyInput(Number(c.valor)), forma_pagamento: c.forma_pagamento ?? '', _tipo: c.tipo, _titulo: `${c.descricao} · ${formatMoney(Number(c.valor))} · vence ${dataCurta(c.vencimento)}` });
    return html`<button type="button" class="row-action" data-drawer-open="drawer-baixa" data-values="${baixa}">${c.tipo === 'receber' ? 'Receber' : 'Pagar'}</button>${editar}${form('cancelar', 'Cancelar', 'Cancelar esta conta?', 'Ela deixa de contar nos totais, mas continua no histórico.')}`;
  }
  return html`${form('reabrir', 'Reabrir', c.status === 'paga' ? 'Desfazer a baixa desta conta?' : 'Reabrir esta conta?', 'A conta volta a ficar em aberto.')}${editar}`;
}

export function linhaConta(c: Conta, opts: { mostrarEvento?: boolean } = {}) {
  const pago = c.status === 'paga' && Number(c.valor_pago) !== Number(c.valor) ? html`<small>pago ${formatMoney(Number(c.valor_pago))}</small>` : '';
  const quando = c.status === 'paga' ? html`<span class="fin-apoio">${c.tipo === 'receber' ? 'Recebida' : 'Paga'} em ${dataCurta(c.pago_em)}${c.forma_pagamento ? ` · ${FORMAS_PAGAMENTO[c.forma_pagamento]}` : ''}</span>` : '';
  return {
    descricao: html`<span class="fin-desc">${c.descricao}${origem(c)}</span>${apoio(c, opts.mostrarEvento ?? true)}`,
    vencimento: html`<span class="tabular">${dataCurta(c.vencimento)}</span>${quando}`,
    valor: html`<span class="fin-valor">${formatMoney(Number(c.valor))}${pago}</span>`,
    situacao: html`<span class="${BADGE[c.situacao]}">${rotuloSituacao(c.tipo, c.situacao)}</span>`,
    acoes: acoes(c),
  };
}

export const COLUNAS_CONTAS = [
  { key: 'descricao', label: 'Conta', ordenar: 'descricao' },
  { key: 'vencimento', label: 'Vencimento', ordenar: 'vencimento' },
  { key: 'valor', label: 'Valor', align: 'right' as const, ordenar: 'valor' },
  { key: 'situacao', label: 'Situação' },
  { key: 'acoes', label: 'Ações', align: 'right' as const },
];

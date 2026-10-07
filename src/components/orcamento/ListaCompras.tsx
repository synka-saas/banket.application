// Aba "Lista de compras" do orçamento (uso interno): quantidades calculadas a partir da porção por pessoa
// dos itens selecionados × convidados, com ajuste manual, marcação de comprado e linhas avulsas.
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  UNIDADES_PORCAO,
  calcularOrcamento,
  formatarQuantidade,
  novaChave,
  quantidadeCompra,
  type ConteudoOrcamento,
  type LinhaCompra,
  type ReferenciasLocacao,
  type UnidadePorcao,
} from '../../lib/calculo/orcamento';
import { Icon } from '../ui/Icon';
import { situacaoEstoque, type EstoqueRef, type SituacaoEstoque } from '../../lib/calculo/estoque';
import { baixarArquivo, toast } from '../../lib/ui';
import { useRemoverComDesfazer } from './controles';
import '../../styles/orcamento.css';

interface Props {
  eventoId: string;
  numero: number;
  congelada: boolean;
  conteudo: ConteudoOrcamento;
  refs: ReferenciasLocacao;
  /** Saldos do estoque (itens ativos), para marcar o que já está coberto */
  estoque: EstoqueRef[];
  exportarUrl: string;
  pdfUrl: string;
}

type Estado = 'salvo' | 'pendente' | 'salvando' | 'erro';
const ROTULO_ESTADO: Record<Estado, string> = { salvo: 'Todas as alterações salvas', pendente: 'Alterações pendentes…', salvando: 'Salvando…', erro: 'Erro ao salvar' };

/** Número decimal digitado em pt-BR ("1,5") ou internacional ("1.5"); vazio = null; inválido = NaN. */
function lerQuantidade(texto: string): number | null {
  const s = texto.trim();
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : Number.NaN;
}
const textoQuantidade = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));

export default function ListaCompras({ eventoId, numero, congelada, conteudo: inicial, refs, estoque, exportarUrl, pdfUrl }: Props) {
  const [conteudo, setConteudo] = useState(() => calcularOrcamento(inicial, congelada ? undefined : refs));
  const [estado, setEstado] = useState<Estado>('salvo');
  const timer = useRef<number | null>(null);
  const linhas = conteudo.lista_compras;
  const convidados = conteudo.pagantes.convidados;

  const ultimoRef = useRef(linhas);
  ultimoRef.current = linhas;
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  // Última lista alterada (atualizada na hora, antes do próximo render), para o salvamento imediato do PDF
  const paraSalvar = useRef(linhas);

  async function enviar(novas: LinhaCompra[]) {
    setEstado('salvando');
    try {
      const res = await fetch(`/api/orcamentos/${eventoId}/versoes/${numero}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lista_compras: novas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar');
      setEstado(timer.current ? 'pendente' : 'salvo');
    } catch (err) {
      setEstado('erro');
      toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error');
    }
  }

  function salvar(novas: LinhaCompra[]) {
    if (timer.current) clearTimeout(timer.current);
    setEstado('pendente');
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void enviar(novas);
    }, 700);
  }

  // PDF: salva o que estiver pendente antes, para o arquivo sair com a última edição
  const [gerandoPdf, setGerandoPdf] = useState(false);
  async function baixarPdf() {
    setGerandoPdf(true);
    (document.activeElement as HTMLElement | null)?.blur?.();
    await new Promise((r) => setTimeout(r, 0));
    try {
      if (!congelada && (timer.current || estadoRef.current !== 'salvo')) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        await enviar(paraSalvar.current);
      }
      await baixarArquivo(pdfUrl);
    } catch {
      toast('Não foi possível gerar o PDF. Tente novamente.', 'error');
    } finally {
      setGerandoPdf(false);
    }
  }

  function alterar(novas: LinhaCompra[]) {
    if (congelada) return;
    paraSalvar.current = novas;
    setConteudo(calcularOrcamento({ ...conteudo, lista_compras: novas }, congelada ? undefined : refs));
    salvar(novas);
  }

  // Fechar a aba logo após digitar não perde a última edição (mesmo padrão das outras abas)
  useEffect(() => {
    const despachar = () => {
      if (congelada) return;
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (estadoRef.current === 'salvo') return;
      void fetch(`/api/orcamentos/${eventoId}/versoes/${numero}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lista_compras: ultimoRef.current }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', despachar);
    return () => window.removeEventListener('pagehide', despachar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atualizar = (key: string, patch: Partial<LinhaCompra>) => alterar(linhas.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remover = useRemoverComDesfazer(linhas, alterar);

  const [focar, setFocar] = useState<string | null>(null);
  useEffect(() => {
    if (!focar) return;
    document.querySelector<HTMLInputElement>(`[data-linha="${focar}"] input[aria-label="Nome do item"]`)?.focus();
    setFocar(null);
  }, [focar]);
  function adicionarManual() {
    const key = novaChave('lc');
    alterar([
      ...linhas,
      { key, ref: null, item_id: null, nome: '', grupo: null, origem: 'manual', unidade: 'un', porcao: null, quantidade_calc: null, quantidade_manual: null, comprado: false, observacao: null },
    ]);
    setFocar(key);
  }

  const semPorcao = linhas.filter((l) => l.origem !== 'manual' && l.quantidade_calc === null && l.quantidade_manual === null).length;
  const comprados = linhas.filter((l) => l.comprado).length;
  const situacoes = new Map(linhas.map((l) => [l.key, situacaoEstoque(l, estoque)]));
  const cobertos = [...situacoes.values()].filter((s) => s?.tipo === 'suficiente').length;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div class="compras">
      <section class="compras-resumo">
        <div>
          <span class="rotulo">Calculado para</span>
          <strong>{convidados.toLocaleString('pt-BR')} {convidados === 1 ? 'convidado' : 'convidados'}</strong>
          <span class="muted">versão {pad(numero)} · quantidade = porção por pessoa × convidados</span>
        </div>
        <div>
          <span class="rotulo">Itens</span>
          <strong>{pad(linhas.length)}</strong>
          <span class="muted">{pad(comprados)} comprados · {pad(cobertos)} em estoque</span>
        </div>
      </section>

      {semPorcao > 0 && (
        <p class="compras-aviso">
          <Icon name="alert-circle" size={18} />
          <span>
            {semPorcao === 1 ? '1 item sem porção cadastrada' : `${semPorcao} itens sem porção cadastrada`}: informe a quantidade aqui ou defina a porção por pessoa em{' '}
            <a class="link" href="/cardapio/itens">Cardápios › Itens</a> para o cálculo ser automático.
          </span>
        </p>
      )}

      {linhas.length === 0 ? (
        <p class="vazio">Nenhum item. Selecione itens nos cardápios do orçamento ou adicione uma linha avulsa.</p>
      ) : (
        <div class="tabela-orc-rolagem">
          <table class="tabela-orc compras-tabela">
            <thead>
              <tr>
                <th class="col-check"><span class="sr-only">Comprado</span></th>
                <th>Item</th>
                <th>Origem</th>
                <th class="num">Porção/pessoa</th>
                <th class="num">Calculado</th>
                <th class="num">Quantidade</th>
                <th>Unid.</th>
                <th>Estoque</th>
                <th>Observação</th>
                {!congelada && <th />}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const manual = l.origem === 'manual';
                const efetiva = quantidadeCompra(l);
                return (
                  <tr key={l.key} data-linha={l.key} class={l.comprado ? 'comprado' : ''}>
                    <td class="col-check">
                      <input type="checkbox" checked={l.comprado} disabled={congelada} aria-label={`${l.nome || 'Item'} comprado`} onChange={(e) => atualizar(l.key, { comprado: e.currentTarget.checked })} />
                    </td>
                    <td>
                      {manual && !congelada ? (
                        <input class="control compacto" value={l.nome} aria-label="Nome do item" maxLength={300} placeholder="Ex.: Gelo" onBlur={(e) => e.currentTarget.value !== l.nome && atualizar(l.key, { nome: e.currentTarget.value.trim() })} />
                      ) : (
                        <strong>{l.nome || '—'}</strong>
                      )}
                    </td>
                    <td class="muted">{manual ? 'Avulso' : l.grupo ?? '—'}</td>
                    <td class="num muted">{l.porcao === null ? '—' : formatarQuantidade(l.porcao, l.unidade)}</td>
                    <td class="num muted">{l.quantidade_calc === null ? '—' : formatarQuantidade(l.quantidade_calc, l.unidade)}</td>
                    <td class="num">
                      <QuantidadeManual linha={l} disabled={congelada} onChange={(v) => atualizar(l.key, { quantidade_manual: v })} />
                      {efetiva !== null && l.unidade && (l.unidade === 'g' || l.unidade === 'ml') && efetiva >= 1000 && (
                        <small class="muted compras-convertido">{formatarQuantidade(efetiva, l.unidade)}</small>
                      )}
                    </td>
                    <td>
                      {manual && !congelada ? (
                        <select class="control compacto" value={l.unidade ?? 'un'} aria-label={`Unidade de ${l.nome || 'item'}`} onChange={(e) => atualizar(l.key, { unidade: e.currentTarget.value as UnidadePorcao })}>
                          {Object.keys(UNIDADES_PORCAO).map((u) => <option value={u}>{u}</option>)}
                        </select>
                      ) : (
                        <span class="muted">{l.unidade ?? '—'}</span>
                      )}
                    </td>
                    <td class="compras-estoque"><CelulaEstoque situacao={situacoes.get(l.key) ?? null} unidade={l.unidade} /></td>
                    <td>
                      <input class="control compacto" value={l.observacao ?? ''} disabled={congelada} aria-label={`Observação de ${l.nome || 'item'}`} maxLength={500} placeholder="Marca, fornecedor…" onBlur={(e) => (e.currentTarget.value || null) !== l.observacao && atualizar(l.key, { observacao: e.currentTarget.value || null })} />
                    </td>
                    {!congelada && (
                      <td class="num">
                        {manual ? (
                          <button type="button" class="remover" aria-label={`Remover ${l.nome || 'linha'}`} onClick={() => remover(l, l.nome || 'Linha')}><Icon name="x" size={18} /></button>
                        ) : (
                          l.quantidade_manual !== null && (
                            <button type="button" class="remover" title="Voltar ao calculado" aria-label={`Voltar ${l.nome} ao calculado`} onClick={() => atualizar(l.key, { quantidade_manual: null })}><Icon name="arrow-back-up" size={18} /></button>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div class="orc-barra">
        {congelada ? (
          <span class="selo-congelada">Versão congelada · somente leitura</span>
        ) : (
          <span class={`orc-estado estado-${estado}`} role="status">{ROTULO_ESTADO[estado]}</span>
        )}
        <div class="orc-barra-acoes">
          <a class="btn btn-outline btn-md" href={exportarUrl}><Icon name="download" size={18} /> Exportar CSV</a>
          <button type="button" class="btn btn-outline btn-md" onClick={baixarPdf} disabled={gerandoPdf}>
            <Icon name="file-text" size={18} /> {gerandoPdf ? 'Gerando PDF…' : 'Exportar PDF'}
          </button>
          {!congelada && (
            <button type="button" class="btn btn-primary btn-md" onClick={adicionarManual}><Icon name="circle-plus" size={18} /> Adicionar linha avulsa</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Situação no estoque: coberto (check), parcial (quanto falta), sem saldo ou não comparável. */
function CelulaEstoque({ situacao: s, unidade }: { situacao: SituacaoEstoque; unidade: UnidadePorcao | null }) {
  if (!s) return <span class="muted">—</span>;
  const un = unidade ?? s.item.unidade;
  if (s.tipo === 'suficiente') {
    return (
      <span class="estoque-ok" title={`Em estoque: ${formatarQuantidade(s.disponivel, un)}`}>
        <Icon name="circle-check" size={16} /> Em estoque
      </span>
    );
  }
  if (s.tipo === 'parcial') {
    return <span class="estoque-parcial" title={`Em estoque: ${formatarQuantidade(s.disponivel, un)}`}>Faltam {formatarQuantidade(s.faltam, un)}</span>;
  }
  if (s.tipo === 'sem') return <span class="estoque-sem">Sem estoque</span>;
  return <span class="muted" title={`Saldo: ${formatarQuantidade(s.item.quantidade, s.item.unidade)} (unidade diferente da lista)`}>{formatarQuantidade(s.item.quantidade, s.item.unidade)} no estoque</span>;
}

/** Quantidade com ajuste manual: vazio = calculado (placeholder); aplicado ao sair do campo. */
function QuantidadeManual(props: { linha: LinhaCompra; disabled: boolean; onChange: (v: number | null) => void }) {
  const { linha: l } = props;
  const [texto, setTexto] = useState(textoQuantidade(l.quantidade_manual));
  useEffect(() => setTexto(textoQuantidade(l.quantidade_manual)), [l.quantidade_manual]);
  const aplicar = () => {
    const v = lerQuantidade(texto);
    if (v === null) props.onChange(null);
    else if (!Number.isNaN(v) && v >= 0) props.onChange(Math.round(v * 1000) / 1000);
    else setTexto(textoQuantidade(l.quantidade_manual));
  };
  return (
    <input
      class={`numero compras-qtd ${l.quantidade_manual !== null ? 'ajustado' : ''}`}
      inputMode="decimal"
      aria-label={`Quantidade de ${l.nome || 'item'}`}
      value={texto}
      placeholder={l.quantidade_calc === null ? '0' : textoQuantidade(l.quantidade_calc)}
      disabled={props.disabled}
      title={l.quantidade_manual !== null ? 'Ajuste manual. Apague para voltar ao calculado.' : 'Quantidade calculada. Digite para ajustar.'}
      onInput={(e) => setTexto(e.currentTarget.value)}
      onBlur={aplicar}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

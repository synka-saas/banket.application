// Construtor de orçamento (frame "Orçamento V2"): cardápios, bebidas, staff, locação e extras,
// com recálculo imediato no navegador e salvamento automático (o servidor recalcula e grava).
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatMoney } from '../../lib/money';
import { calcularOrcamento, type ConteudoOrcamento, type EspacoRef, type ReferenciasLocacao } from '../../lib/calculo/orcamento';
import { calcularMargem } from '../../lib/calculo/margem';
import type { CatalogoConstrutor } from '../../server/orcamento';
import { Numero, ValorManual } from './controles';
import Cardapios from './Cardapios';
import Bebidas from './Bebidas';
import Staff from './Staff';
import LocacaoExtras from './LocacaoExtras';
import { Icon } from '../ui/Icon';
import { baixarArquivo, confirmar, toast } from '../../lib/ui';
import '../../styles/orcamento.css';

interface Props {
  eventoId: string;
  numero: number;
  congelada: boolean;
  cliente: { nome: string; documento: string | null };
  conteudo: ConteudoOrcamento;
  catalogo: CatalogoConstrutor;
  refs: ReferenciasLocacao;
  /** Espaços para o select da locação (ativos + o já escolhido) */
  espacos: EspacoRef[];
  idades: { isentas: number; meia: number };
  pdfUrl: string;
}

type Estado = 'salvo' | 'pendente' | 'salvando' | 'erro';

const pad = (n: number) => String(n).padStart(2, '0');

export default function OrcamentoBuilder(props: Props) {
  // Versão congelada recalcula sem as referências de locação (mantém o valor gravado)
  const [conteudo, setConteudo] = useState<ConteudoOrcamento>(() => calcularOrcamento(props.conteudo, props.congelada ? undefined : props.refs));
  const [estado, setEstado] = useState<Estado>('salvo');
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const ultimo = useRef(conteudo);
  const salvando = useRef<Promise<void> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const disabled = props.congelada;
  const totais = conteudo.totais!;

  const corpo = (c: ConteudoOrcamento) =>
    JSON.stringify({
      pagantes: c.pagantes,
      cardapios: c.cardapios,
      bebidas: c.bebidas,
      staff: c.staff,
      locacao: c.locacao,
      extras: c.extras,
      total_manual: c.total_manual,
      mostrar_valor_total: c.mostrar_valor_total,
      observacoes: c.observacoes,
    });

  async function salvarAgora() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const c = ultimo.current;
    setEstado('salvando');
    const req = (async () => {
      try {
        const res = await fetch(`/api/orcamentos/${props.eventoId}/versoes/${props.numero}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: corpo(c),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar');
        setErro(null);
        setEstado(ultimo.current === c ? 'salvo' : 'pendente');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao salvar';
        setErro(msg);
        setEstado('erro');
        toast(msg, 'error');
      }
    })();
    salvando.current = req;
    await req;
  }

  function alterar(patch: Partial<ConteudoOrcamento>) {
    if (disabled) return;
    const novo = calcularOrcamento({ ...ultimo.current, ...patch }, props.refs);
    ultimo.current = novo;
    setConteudo(novo);
    setEstado('pendente');
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(salvarAgora, 800);
  }

  // Avisa antes de sair com alterações não salvas
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (estado === 'pendente' || estado === 'salvando') {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [estado]);

  // Fechar a aba logo após digitar não perde a última edição: o campo ativo é aplicado (blur)
  // e o conteúdo segue num envio keepalive, que sobrevive à saída da página (UX-126)
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  useEffect(() => {
    const despachar = () => {
      if (disabled) return;
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (estadoRef.current === 'salvo') return;
      void fetch(`/api/orcamentos/${props.eventoId}/versoes/${props.numero}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: corpo(ultimo.current),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', despachar);
    return () => window.removeEventListener('pagehide', despachar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [gerandoPdf, setGerandoPdf] = useState(false);
  async function baixarPdf() {
    setGerandoPdf(true);
    if (estado === 'pendente') await salvarAgora();
    else if (salvando.current) await salvando.current;
    // Libera o botão quando o PDF chega (gerar leva alguns segundos), não por tempo fixo
    try {
      await baixarArquivo(props.pdfUrl);
    } catch {
      toast('Não foi possível baixar o PDF. Tente novamente.', 'error');
    } finally {
      setGerandoPdf(false);
    }
  }

  async function novaVersao(e: Event) {
    e.preventDefault();
    const sim = await confirmar({
      titulo: `Criar a versão ${pad(props.numero + 1)}?`,
      texto: `A versão ${pad(props.numero)} ficará congelada, somente para consulta.`,
      confirmar: 'Criar versão',
    });
    if (!sim) return;
    if (estado === 'pendente') await salvarAgora();
    else if (salvando.current) await salvando.current;
    formRef.current?.submit();
  }

  const p = conteudo.pagantes;
  const margem = calcularMargem(conteudo);
  const rotuloEstado = { salvo: 'Todas as alterações salvas', pendente: 'Alterações pendentes…', salvando: 'Salvando…', erro: 'Erro ao salvar' }[
    estado
  ];

  return (
    <div class="orc">
      <section class="orc-cabecalho">
        <div class="orc-cliente">
          <span class="rotulo">Cliente</span>
          <strong>{props.cliente.nome}</strong>
          {props.cliente.documento && <span class="muted">{props.cliente.documento}</span>}
        </div>
        <div class="orc-valor">
          <span class="orc-versao">
            <span class="rotulo">Versão: {pad(props.numero)}</span>
            {!disabled && (
              <form method="post" ref={formRef} onSubmit={novaVersao}>
                <input type="hidden" name="_action" value="nova_versao" />
                <button type="submit" class="btn btn-text">
                  Criar nova versão
                </button>
              </form>
            )}
          </span>
          <strong class="orc-total">{formatMoney(totais.total)}</strong>
          {conteudo.total_manual !== null && <span class="muted">calculado: {formatMoney(totais.total_calc)}</span>}
        </div>
      </section>

      <section class="orc-pagantes">
        <label>
          Convidados
          <Numero
            label="Convidados"
            valor={p.convidados}
            min={0}
            disabled={disabled}
            onChange={(v) => alterar({ pagantes: { ...p, convidados: v ?? 0 } })}
          />
        </label>
        <label>
          Crianças meia (até {props.idades.meia} anos)
          <Numero
            label="Crianças que pagam meia"
            valor={p.criancas_meia}
            min={0}
            disabled={disabled}
            onChange={(v) => alterar({ pagantes: { ...p, criancas_meia: Math.min(v ?? 0, p.convidados - p.criancas_isentas) } })}
          />
        </label>
        <label>
          Crianças isentas (até {props.idades.isentas} anos)
          <Numero
            label="Crianças isentas"
            valor={p.criancas_isentas}
            min={0}
            disabled={disabled}
            onChange={(v) => alterar({ pagantes: { ...p, criancas_isentas: Math.min(v ?? 0, p.convidados - p.criancas_meia) } })}
          />
        </label>
        <div class="orc-equivalentes">
          <span class="rotulo" title="Pagantes = convidados − isentas − meia + meia × 0,5">
            Pagantes <Icon name="help-circle" size={14} />
          </span>
          <strong>{totais.pagantes_equivalentes.toLocaleString('pt-BR')}</strong>
        </div>
      </section>

      <Cardapios
        cardapios={conteudo.cardapios}
        catalogo={props.catalogo}
        equivalentes={totais.pagantes_equivalentes}
        total={totais.alimentos}
        disabled={disabled}
        onChange={(cardapios) => alterar({ cardapios })}
      />
      <Bebidas
        bebidas={conteudo.bebidas}
        catalogo={props.catalogo}
        equivalentes={totais.pagantes_equivalentes}
        total={totais.bebidas}
        disabled={disabled}
        onChange={(bebidas) => alterar({ bebidas })}
      />
      <Staff
        staff={conteudo.staff}
        catalogo={props.catalogo}
        convidados={p.convidados}
        total={totais.staff}
        disabled={disabled}
        onChange={(staff) => alterar({ staff })}
      />
      <LocacaoExtras
        locacao={conteudo.locacao}
        espacos={props.espacos}
        extras={conteudo.extras}
        totalLocacao={totais.locacao}
        totalExtras={totais.extras}
        disabled={disabled}
        onLocacao={(locacao) => alterar({ locacao })}
        onExtras={(extras) => alterar({ extras })}
      />

      <section class="orc-totais">
        <h3 class="bloco-titulo"><Icon name="receipt" size={18} /> Resumo do orçamento</h3>
        <dl>
          <div>
            <dt>Alimentos</dt>
            <dd>{formatMoney(totais.alimentos)}</dd>
          </div>
          <div>
            <dt>Bebidas</dt>
            <dd>{formatMoney(totais.bebidas)}</dd>
          </div>
          <div>
            <dt>Staff</dt>
            <dd>{formatMoney(totais.staff)}</dd>
          </div>
          <div>
            <dt>Locação</dt>
            <dd>{formatMoney(totais.locacao)}</dd>
          </div>
          <div>
            <dt>Extras</dt>
            <dd>{formatMoney(totais.extras)}</dd>
          </div>
          <div class="calc">
            <dt>Total calculado</dt>
            <dd>{formatMoney(totais.total_calc)}</dd>
          </div>
        </dl>
        <div class="orc-margem" aria-label="Margem projetada">
          <div>
            <span class="rotulo">Custo dos insumos (estimado)</span>
            <strong>{formatMoney(margem.custo)}</strong>
            <span class="muted">{formatMoney(margem.custo_por_convidado)} por convidado</span>
          </div>
          <div>
            <span class="rotulo">Margem de alimentos e bebidas</span>
            <strong class={margem.margem_pct === null ? '' : margem.margem_pct < 30 ? 'margem-baixa' : margem.margem_pct < 50 ? 'margem-media' : 'margem-boa'}>
              {margem.margem_pct === null ? '—' : `${margem.margem_pct.toLocaleString('pt-BR')}%`}
            </strong>
            <span class="muted">{margem.margem_pct === null ? 'cadastre o custo dos itens' : formatMoney(margem.margem_valor)}</span>
          </div>
          {margem.sem_custo.length > 0 && (
            <p class="orc-margem-aviso">
              <Icon name="alert-circle" size={16} /> {margem.sem_custo.length === 1 ? '1 item sem custo cadastrado' : `${margem.sem_custo.length} itens sem custo cadastrado`}: a margem fica maior do que a real.{' '}
              <a class="link" href={`/eventos/${props.eventoId}/assistente-orcamento?versao=${props.numero}`}>Ver detalhes</a>
            </p>
          )}
        </div>
        <div class="orc-total-final">
          <label>
            Valor final da proposta
            <ValorManual
              label="Valor final da proposta"
              manual={conteudo.total_manual}
              calculado={totais.total_calc}
              disabled={disabled}
              onChange={(v) => alterar({ total_manual: v })}
            />
          </label>
          <label class="switch">
            <input
              type="checkbox"
              checked={conteudo.mostrar_valor_total}
              disabled={disabled}
              onChange={(e) => alterar({ mostrar_valor_total: e.currentTarget.checked })}
            />
            Mostrar o valor total na proposta
          </label>
        </div>
        <label class="orc-observacoes">
          Observações internas
          <textarea
            class="control"
            rows={3}
            disabled={disabled}
            maxLength={5000}
            value={conteudo.observacoes ?? ''}
            onBlur={(e) => e.currentTarget.value !== (conteudo.observacoes ?? '') && alterar({ observacoes: e.currentTarget.value || null })}
          />
        </label>
      </section>

      {/* Barra de ações flutuante: estado do salvamento automático à esquerda, ações à direita (primária por último) */}
      <div class="orc-barra">
        {disabled ? (
          <span class="selo-congelada">Versão congelada · somente leitura</span>
        ) : (
          <span class={`orc-estado estado-${estado}`} role="status" title={erro ?? undefined}>
            {rotuloEstado}
          </span>
        )}
        <div class="orc-barra-acoes">
          <button type="button" class="btn btn-outline btn-md" onClick={baixarPdf} disabled={gerandoPdf}>
            <Icon name="download" size={18} />
            {gerandoPdf ? 'Gerando PDF…' : disabled ? 'Baixar PDF' : 'Salvar e baixar PDF'}
          </button>
          <button
            type="button"
            class="btn btn-primary btn-md"
            data-drawer-open="drawer-enviar"
            onClick={() => estado === 'pendente' && salvarAgora()}
          >
            <Icon name="send" size={18} /> Enviar ao cliente
          </button>
        </div>
      </div>
    </div>
  );
}

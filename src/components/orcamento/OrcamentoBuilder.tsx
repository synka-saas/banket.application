// Construtor de orçamento (frame "Orçamento V2"): cardápios, bebidas, staff, locação e extras,
// com recálculo imediato no navegador e salvamento automático (o servidor recalcula e grava).
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatMoney } from '../../lib/money';
import { calcularOrcamento, type ConteudoOrcamento, type FaixaLocacaoRef } from '../../lib/calculo/orcamento';
import type { CatalogoConstrutor } from '../../server/orcamento';
import { Numero, ValorManual } from './controles';
import Cardapios from './Cardapios';
import Bebidas from './Bebidas';
import Staff from './Staff';
import LocacaoExtras from './LocacaoExtras';
import { Icon } from '../ui/Icon';
import '../../styles/orcamento.css';

interface Props {
  eventoId: string;
  numero: number;
  congelada: boolean;
  cliente: { nome: string; documento: string | null };
  conteudo: ConteudoOrcamento;
  catalogo: CatalogoConstrutor;
  faixas: FaixaLocacaoRef[];
  idades: { isentas: number; meia: number };
  pdfUrl: string;
}

type Estado = 'salvo' | 'pendente' | 'salvando' | 'erro';

const pad = (n: number) => String(n).padStart(2, '0');

function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  (window as unknown as { banketToast?: (m: string, t: string) => void }).banketToast?.(message, type);
}

export default function OrcamentoBuilder(props: Props) {
  const [conteudo, setConteudo] = useState<ConteudoOrcamento>(() => calcularOrcamento(props.conteudo, props.faixas));
  const [estado, setEstado] = useState<Estado>('salvo');
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const ultimo = useRef(conteudo);
  const salvando = useRef<Promise<void> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const disabled = props.congelada;
  const totais = conteudo.totais!;

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
          body: JSON.stringify({
            pagantes: c.pagantes,
            cardapios: c.cardapios,
            bebidas: c.bebidas,
            staff: c.staff,
            locacao: c.locacao,
            extras: c.extras,
            total_manual: c.total_manual,
            mostrar_valor_total: c.mostrar_valor_total,
            observacoes: c.observacoes,
          }),
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
    const novo = calcularOrcamento({ ...ultimo.current, ...patch }, props.faixas);
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

  const [gerandoPdf, setGerandoPdf] = useState(false);
  async function baixarPdf() {
    setGerandoPdf(true);
    if (estado === 'pendente') await salvarAgora();
    else if (salvando.current) await salvando.current;
    window.location.href = props.pdfUrl;
    // O download não troca de página; libera o botão depois de alguns segundos
    setTimeout(() => setGerandoPdf(false), 6000);
  }

  async function novaVersao(e: Event) {
    e.preventDefault();
    if (!window.confirm(`Criar a versão ${pad(props.numero + 1)}? A versão ${pad(props.numero)} ficará congelada, somente para consulta.`)) return;
    if (estado === 'pendente') await salvarAgora();
    else if (salvando.current) await salvando.current;
    formRef.current?.submit();
  }

  const p = conteudo.pagantes;
  const rotuloEstado = { salvo: 'Todas as alterações salvas', pendente: 'Alterações pendentes…', salvando: 'Salvando…', erro: 'Erro ao salvar' }[
    estado
  ];

  return (
    <div class="orc">
      <section class="orc-cabecalho">
        <div>
          <span class="rotulo">Cliente</span>
          <strong>{props.cliente.nome}</strong>
          {props.cliente.documento && <span class="muted">{props.cliente.documento}</span>}
        </div>
        <div>
          <span class="rotulo">Versão: {pad(props.numero)}</span>
          <strong class="orc-total">{formatMoney(totais.total)}</strong>
          {conteudo.total_manual !== null && <span class="muted">calculado: {formatMoney(totais.total_calc)}</span>}
        </div>
        <div class="orc-acoes">
          <div class="orc-botoes">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              data-drawer-open="drawer-enviar"
              onClick={() => estado === 'pendente' && salvarAgora()}
            >
              Enviar ao cliente
            </button>
            <button type="button" class="btn btn-success btn-sm" onClick={baixarPdf} disabled={gerandoPdf}>
              {gerandoPdf ? 'Gerando PDF…' : disabled ? 'Baixar PDF' : 'Salvar e baixar PDF'}
            </button>
          </div>
          {disabled ? (
            <span class="selo-congelada">Versão congelada · somente leitura</span>
          ) : (
            <>
              <span class={`orc-estado estado-${estado}`} role="status" title={erro ?? undefined}>
                {rotuloEstado}
              </span>
              <form method="post" ref={formRef} onSubmit={novaVersao}>
                <input type="hidden" name="_action" value="nova_versao" />
                <button type="submit" class="btn btn-primary btn-sm">
                  Criar nova versão
                </button>
              </form>
            </>
          )}
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
          <span class="rotulo">Pagantes</span>
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
        extras={conteudo.extras}
        totalLocacao={totais.locacao}
        totalExtras={totais.extras}
        disabled={disabled}
        onLocacao={(locacao) => alterar({ locacao })}
        onExtras={(extras) => alterar({ extras })}
      />

      <section class="orc-totais">
        <h3 class="bloco-titulo"><Icon name="account_circle" size={18} /> Resumo do orçamento</h3>
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
    </div>
  );
}

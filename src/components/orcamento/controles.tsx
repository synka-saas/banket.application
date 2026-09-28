// Controles compartilhados pelo construtor de orçamento.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatMoney, moneyInput, parseMoney } from '../../lib/money';
import { Icon } from '../ui/Icon';
import { toast } from '../../lib/ui';

/**
 * Remoção dentro do orçamento sem modal, com "Desfazer" no aviso. O desfazer devolve o item à posição original
 * na lista atual (não num retrato antigo), para não perder o que foi editado nesse meio-tempo.
 */
export function useRemoverComDesfazer<T extends { key: string }>(lista: T[], aplicar: (nova: T[]) => void) {
  const atual = useRef(lista);
  atual.current = lista;
  const aplicarAtual = useRef(aplicar);
  aplicarAtual.current = aplicar;
  return (item: T, nome: string) => {
    const posicao = atual.current.findIndex((x) => x.key === item.key);
    aplicarAtual.current(atual.current.filter((x) => x.key !== item.key));
    toast(`"${nome}" removido.`, 'info', {
      acao: {
        rotulo: 'Desfazer',
        executar: () => {
          if (atual.current.some((x) => x.key === item.key)) return;
          const nova = [...atual.current];
          nova.splice(Math.min(Math.max(posicao, 0), nova.length), 0, item);
          aplicarAtual.current(nova);
        },
      },
    });
  };
}

/**
 * Valor monetário com ajuste manual: vazio = usa o calculado (mostrado como placeholder).
 * O valor só é aplicado ao sair do campo (ou Enter), evitando recálculos a cada tecla.
 */
export function ValorManual(props: {
  manual: number | null;
  calculado?: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  label: string;
  compacto?: boolean;
  /** Campo de valor simples (sem conceito de calculado × manual) */
  simples?: boolean;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState(moneyInput(props.manual));
  useEffect(() => setTexto(moneyInput(props.manual)), [props.manual]);

  const aplicar = () => {
    const v = parseMoney(texto);
    if (v === null) props.onChange(null);
    else if (!Number.isNaN(v) && v >= 0) props.onChange(Math.round(v * 100) / 100);
    else setTexto(moneyInput(props.manual));
  };

  const ajustado = !props.simples && props.manual !== null;
  return (
    <span class={`valor-manual ${ajustado ? 'ajustado' : ''} ${props.compacto ? 'compacto' : ''}`}>
      <span class="prefixo">R$</span>
      <input
        inputMode="decimal"
        aria-label={props.label}
        value={texto}
        placeholder={props.calculado === null || props.calculado === undefined ? (props.placeholder ?? '0,00') : moneyInput(props.calculado)}
        disabled={props.disabled}
        onInput={(e) => setTexto(e.currentTarget.value)}
        onBlur={aplicar}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        title={props.simples ? undefined : ajustado ? `Ajuste manual (calculado: ${formatMoney(props.calculado ?? 0)}). Apague para voltar ao calculado.` : 'Valor calculado. Digite para ajustar.'}
      />
      {ajustado && !props.disabled && (
        <button type="button" class="restaurar" title="Voltar ao valor calculado" aria-label={`Voltar ${props.label} ao valor calculado`} onClick={() => props.onChange(null)}>
          <Icon name="undo" size={16} />
        </button>
      )}
    </span>
  );
}

/** Número inteiro com o mesmo comportamento (vazio = calculado, quando houver). */
export function Numero(props: {
  valor: number | null;
  calculado?: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  label: string;
  min?: number;
  permitirVazio?: boolean;
}) {
  const [texto, setTexto] = useState(props.valor === null ? '' : String(props.valor));
  useEffect(() => setTexto(props.valor === null ? '' : String(props.valor)), [props.valor]);
  const aplicar = () => {
    if (texto.trim() === '') return props.onChange(props.permitirVazio ? null : (props.min ?? 0));
    const n = Number.parseInt(texto, 10);
    if (Number.isFinite(n) && n >= (props.min ?? 0)) props.onChange(n);
    else setTexto(props.valor === null ? '' : String(props.valor));
  };
  return (
    <input
      class={`numero ${props.permitirVazio && props.valor !== null ? 'ajustado' : ''}`}
      type="number"
      min={props.min ?? 0}
      aria-label={props.label}
      value={texto}
      placeholder={props.calculado === null || props.calculado === undefined ? '' : String(props.calculado)}
      disabled={props.disabled}
      onInput={(e) => setTexto(e.currentTarget.value)}
      onBlur={aplicar}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

/** Seção recolhível no estilo dos frames (ícone laranja + título + botão circular). */
export function Acordeao(props: { titulo: string; icone?: string; resumo?: string; aberto?: boolean; children: ComponentChildren }) {
  const [aberto, setAberto] = useState(props.aberto ?? true);
  return (
    <section class={`acordeao ${aberto ? 'aberto' : ''}`}>
      <button type="button" class="acordeao-cabecalho" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        <Icon name={props.icone ?? 'expand_circle_right'} size={18} class="acordeao-icone" />
        <span class="acordeao-titulo">{props.titulo}</span>
        {props.resumo && <span class="acordeao-resumo">{props.resumo}</span>}
        <Icon name="expand_circle_down" size={22} class="acordeao-seta" />
      </button>
      {aberto && <div class="acordeao-corpo">{props.children}</div>}
    </section>
  );
}

export interface OpcaoAdicionar {
  valor: string;
  rotulo: string;
  /** Texto secundário (preço, regra…) */
  detalhe?: string;
  grupo?: string;
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let seqAdicionar = 0;

/**
 * "Adicionar ▾" com busca: um só padrão para incluir cardápio, seção, item, bebida e função no orçamento.
 * Escolher uma opção já adiciona. Teclado: ↑/↓ percorre, Enter escolhe, Esc fecha (combobox acessível).
 */
export function AdicionarBusca(props: {
  rotulo: string;
  opcoes: OpcaoAdicionar[];
  onEscolher: (valor: string) => void;
  disabled?: boolean;
  compacto?: boolean;
  vazio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const id = useRef(`adicionar-${++seqAdicionar}`).current;

  const termo = normalizar(busca.trim());
  const filtradas = termo
    ? props.opcoes.filter((o) => normalizar(`${o.rotulo} ${o.detalhe ?? ''} ${o.grupo ?? ''}`).includes(termo))
    : props.opcoes;

  useEffect(() => {
    if (!aberto) return;
    campo.current?.focus();
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  function fechar(devolverFoco = true) {
    setAberto(false);
    setBusca('');
    setAtivo(0);
    if (devolverFoco) botao.current?.focus();
  }

  function escolher(o: OpcaoAdicionar | undefined) {
    if (!o) return;
    fechar();
    props.onEscolher(o.valor);
  }

  function teclado(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      escolher(filtradas[ativo]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      fechar();
    }
  }

  let grupoAnterior: string | undefined;
  return (
    <div class={`adicionar${props.compacto ? ' compacto' : ''}`} ref={raiz}>
      <button
        type="button"
        ref={botao}
        class={`btn btn-outline ${props.compacto ? 'btn-sm' : 'btn-md'}`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        disabled={props.disabled}
        onClick={() => (aberto ? fechar() : setAberto(true))}
      >
        <Icon name="add_circle" size={18} /> {props.rotulo} <Icon name="expand_more" size={18} />
      </button>
      {aberto && (
        <div class="adicionar-painel">
          <input
            ref={campo}
            class="control"
            type="search"
            role="combobox"
            aria-label={`${props.rotulo}: buscar`}
            aria-expanded="true"
            aria-controls={`${id}-lista`}
            aria-activedescendant={filtradas[ativo] ? `${id}-${ativo}` : undefined}
            placeholder="Buscar…"
            value={busca}
            onInput={(e) => {
              setBusca(e.currentTarget.value);
              setAtivo(0);
            }}
            onKeyDown={teclado}
          />
          <ul id={`${id}-lista`} role="listbox" class="adicionar-lista" aria-label={props.rotulo}>
            {filtradas.length === 0 && <li class="adicionar-vazio">{props.vazio ?? 'Nada encontrado.'}</li>}
            {filtradas.map((o, i) => {
              const cabecalho = o.grupo && o.grupo !== grupoAnterior ? o.grupo : null;
              grupoAnterior = o.grupo;
              return (
                <>
                  {cabecalho && <li class="adicionar-grupo" role="presentation">{cabecalho}</li>}
                  <li
                    id={`${id}-${i}`}
                    role="option"
                    aria-selected={i === ativo}
                    class={i === ativo ? 'ativo' : ''}
                    onMouseEnter={() => setAtivo(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => escolher(o)}
                  >
                    <span>{o.rotulo}</span>
                    {o.detalhe && <span class="adicionar-detalhe">{o.detalhe}</span>}
                  </li>
                </>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

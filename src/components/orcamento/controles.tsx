// Controles compartilhados pelo construtor de orçamento.
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { formatMoney, moneyInput, parseMoney } from '../../lib/money';
import { Icon } from '../ui/Icon';

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
        <Icon name={props.icone ?? 'account_circle'} size={18} class="acordeao-icone" />
        <span class="acordeao-titulo">{props.titulo}</span>
        {props.resumo && <span class="acordeao-resumo">{props.resumo}</span>}
        <Icon name="expand_circle_down" size={22} class="acordeao-seta" />
      </button>
      {aberto && <div class="acordeao-corpo">{props.children}</div>}
    </section>
  );
}

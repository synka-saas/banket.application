// Acordeão "Locação e extras": locação pelo espaço escolhido (faixa de convidados no espaço próprio, valor de
// referência no de terceiro) e taxas avulsas (hora adicional, rolha…). Trocar o espaço aqui também atualiza o evento.
import { useEffect, useState } from 'preact/hooks';
import { formatMoney } from '../../lib/money';
import { novaChave, type EspacoRef, type ExtraOrcamento, type LocacaoOrcamento } from '../../lib/calculo/orcamento';
import { Acordeao, Numero, ValorManual, useRemoverComDesfazer } from './controles';
import { Icon } from '../ui/Icon';

const SUGESTOES = ['Hora adicional', 'Taxa de rolha', 'Taxa de serviço de chope', 'Taxa de cerimônia no local', 'Taxa de serviço externo'];

interface Props {
  locacao: LocacaoOrcamento;
  espacos: EspacoRef[];
  extras: ExtraOrcamento[];
  totalLocacao: number;
  totalExtras: number;
  disabled: boolean;
  onLocacao: (l: LocacaoOrcamento) => void;
  onExtras: (e: ExtraOrcamento[]) => void;
}

export default function LocacaoExtras({ locacao, espacos, extras, totalLocacao, totalExtras, disabled, onLocacao, onExtras }: Props) {
  const proprios = espacos.filter((e) => e.tipo === 'proprio');
  const terceiros = espacos.filter((e) => e.tipo === 'terceiro');
  const espacoAtual = espacos.find((e) => e.id === locacao.espaco_id) ?? null;
  const semFaixa = espacoAtual?.tipo === 'proprio' ? 'Nenhuma faixa de locação para este número de convidados' : null;
  const trocarEspaco = (id: string) => {
    const espaco = espacos.find((e) => e.id === id) ?? null;
    onLocacao({ ...locacao, espaco_id: espaco?.id ?? null, espaco_nome: espaco?.nome ?? null });
  };
  const remover = useRemoverComDesfazer(extras, onExtras);
  // Linha nova nasce vazia, com o foco na descrição (as sugestões aparecem na lista do campo)
  const [focar, setFocar] = useState<string | null>(null);
  useEffect(() => {
    if (!focar) return;
    document.querySelector<HTMLInputElement>(`[data-extra="${focar}"]`)?.focus();
    setFocar(null);
  }, [focar]);
  function adicionarExtra() {
    const key = novaChave('e');
    onExtras([...extras, { key, descricao: '', quantidade: 1, valor_unit: 0 }]);
    setFocar(key);
  }
  const atualizar = (key: string, patch: Partial<ExtraOrcamento>) =>
    onExtras(extras.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  return (
    <Acordeao titulo="Locação e extras" icone="building-store" resumo={formatMoney(totalLocacao + totalExtras)} aberto={locacao.incluir || extras.length > 0}>
      <div class="locacao">
        <label class="switch">
          <input type="checkbox" checked={locacao.incluir} disabled={disabled} onChange={(e) => onLocacao({ ...locacao, incluir: e.currentTarget.checked })} />
          Incluir locação do espaço
        </label>
        {locacao.incluir && (
          <div class="locacao-detalhe">
            <label class="locacao-espaco">
              <span>Espaço</span>
              <select class="control compacto" value={locacao.espaco_id ?? ''} disabled={disabled} onChange={(e) => trocarEspaco(e.currentTarget.value)}>
                {proprios.length > 0 && (
                  <optgroup label="Nossos espaços">
                    {proprios.map((e) => <option value={e.id}>{e.nome}{e.ativo ? '' : ' (inativo)'}</option>)}
                  </optgroup>
                )}
                {terceiros.length > 0 && (
                  <optgroup label="Espaços de terceiros">
                    {terceiros.map((e) => <option value={e.id}>{e.nome}{e.ativo ? '' : ' (inativo)'}</option>)}
                  </optgroup>
                )}
                <option value="">Outro local (sem espaço cadastrado)</option>
              </select>
            </label>
            <span class="muted">{locacao.descricao ?? semFaixa ?? (locacao.espaco_id ? 'Sem valor de referência cadastrado' : 'Informe o valor da locação')}</span>
            <ValorManual label="Valor da locação" manual={locacao.valor_manual} calculado={locacao.valor_calc} disabled={disabled} onChange={(v) => onLocacao({ ...locacao, valor_manual: v })} />
            {!disabled && <span class="field-hint locacao-dica">Trocar o espaço aqui também atualiza o evento.</span>}
          </div>
        )}
      </div>

      <h4 class="subtitulo">Extras</h4>
      {extras.length === 0 && <p class="vazio">Nenhum extra. Use para hora adicional, taxas e serviços avulsos.</p>}
      {extras.length > 0 && (
        <div class="tabela-orc-rolagem"><table class="tabela-orc">
          <thead>
            <tr>
              <th>Descrição</th>
              <th class="num">Qtd.</th>
              <th class="num">Valor unit.</th>
              <th class="num">Subtotal</th>
              {!disabled && <th />}
            </tr>
          </thead>
          <tbody>
            {extras.map((e) => (
              <tr key={e.key}>
                <td>
                  <input class="control compacto" list="sugestoes-extras" value={e.descricao} disabled={disabled} aria-label="Descrição do extra" maxLength={300}
                    data-extra={e.key} placeholder="Ex.: Hora adicional"
                    onBlur={(ev) => atualizar(e.key, { descricao: ev.currentTarget.value.trim() || 'Extra' })} />
                </td>
                <td class="num">
                  <Numero label={`Quantidade de ${e.descricao}`} valor={e.quantidade} min={0} disabled={disabled} onChange={(v) => atualizar(e.key, { quantidade: v ?? 0 })} />
                </td>
                <td class="num">
                  <ValorManual label={`Valor de ${e.descricao}`} manual={e.valor_unit} disabled={disabled} compacto simples onChange={(v) => atualizar(e.key, { valor_unit: v ?? 0 })} />
                </td>
                <td class="num"><strong>{formatMoney(e.subtotal_calc ?? 0)}</strong></td>
                {!disabled && (
                  <td class="num">
                    <button type="button" class="remover" aria-label={`Remover ${e.descricao}`} onClick={() => remover(e, e.descricao || 'Extra')}><Icon name="x" size={18} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      <datalist id="sugestoes-extras">{SUGESTOES.map((s) => <option value={s} />)}</datalist>
      {!disabled && (
        <button type="button" class="btn btn-outline btn-md" onClick={adicionarExtra}>
          <Icon name="circle-plus" size={18} /> Adicionar extra
        </button>
      )}
    </Acordeao>
  );
}

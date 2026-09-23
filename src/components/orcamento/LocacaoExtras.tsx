// Acordeão "Locação e extras": locação por faixa de convidados e taxas avulsas (hora adicional, rolha…).
import { formatMoney } from '../../lib/money';
import { novaChave, type ExtraOrcamento, type LocacaoOrcamento } from '../../lib/calculo/orcamento';
import { Acordeao, Numero, ValorManual } from './controles';
import { Icon } from '../ui/Icon';

const SUGESTOES = ['Hora adicional', 'Taxa de rolha', 'Taxa de serviço de chope', 'Taxa de cerimônia no local', 'Taxa de serviço externo'];

interface Props {
  locacao: LocacaoOrcamento;
  extras: ExtraOrcamento[];
  totalLocacao: number;
  totalExtras: number;
  disabled: boolean;
  onLocacao: (l: LocacaoOrcamento) => void;
  onExtras: (e: ExtraOrcamento[]) => void;
}

export default function LocacaoExtras({ locacao, extras, totalLocacao, totalExtras, disabled, onLocacao, onExtras }: Props) {
  const atualizar = (key: string, patch: Partial<ExtraOrcamento>) =>
    onExtras(extras.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  return (
    <Acordeao titulo="Locação e extras" resumo={formatMoney(totalLocacao + totalExtras)} aberto={locacao.incluir || extras.length > 0}>
      <div class="locacao">
        <label class="switch">
          <input type="checkbox" checked={locacao.incluir} disabled={disabled} onChange={(e) => onLocacao({ ...locacao, incluir: e.currentTarget.checked })} />
          Incluir locação do espaço
        </label>
        {locacao.incluir && (
          <div class="locacao-detalhe">
            <span class="muted">{locacao.descricao ?? 'Nenhuma faixa de locação para este número de convidados'}</span>
            <ValorManual label="Valor da locação" manual={locacao.valor_manual} calculado={locacao.valor_calc} disabled={disabled} onChange={(v) => onLocacao({ ...locacao, valor_manual: v })} />
          </div>
        )}
      </div>

      <h4 class="subtitulo">Extras</h4>
      {extras.length === 0 && <p class="vazio">Nenhum extra. Use para hora adicional, taxas e serviços avulsos.</p>}
      {extras.length > 0 && (
        <table class="tabela-orc">
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
                    <button type="button" class="remover" aria-label={`Remover ${e.descricao}`} onClick={() => onExtras(extras.filter((x) => x.key !== e.key))}><Icon name="close" size={18} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <datalist id="sugestoes-extras">{SUGESTOES.map((s) => <option value={s} />)}</datalist>
      {!disabled && (
        <button type="button" class="btn btn-outline btn-md" onClick={() => onExtras([...extras, { key: novaChave('e'), descricao: 'Hora adicional', quantidade: 1, valor_unit: 0 }])}>
          <Icon name="add_circle" size={18} /> Adicionar extra
        </button>
      )}
    </Acordeao>
  );
}

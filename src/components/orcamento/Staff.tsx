// Acordeão "Staff": funções calculadas pelas regras de Serviços e Custos, com ajuste manual.
import { useState } from 'preact/hooks';
import { formatMoney } from '../../lib/money';
import { descreverRegra } from '../../lib/calculo/staff';
import { novaChave, type StaffOrcamento } from '../../lib/calculo/orcamento';
import type { CatalogoConstrutor } from '../../server/orcamento';
import { Acordeao, Numero, ValorManual } from './controles';
import { Icon } from '../ui/Icon';

interface Props {
  staff: StaffOrcamento[];
  catalogo: CatalogoConstrutor;
  convidados: number;
  total: number;
  disabled: boolean;
  onChange: (staff: StaffOrcamento[]) => void;
}

export default function Staff({ staff, catalogo, convidados, total, disabled, onChange }: Props) {
  const [servicoId, setServicoId] = useState('');
  const atualizar = (key: string, patch: Partial<StaffOrcamento>) =>
    onChange(staff.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  function adicionar() {
    const s = catalogo.servicos.find((x) => x.id === servicoId);
    if (!s) return;
    onChange([...staff, { key: novaChave('s'), servico_id: s.id, funcao: s.funcao, regra: s.regra, quantidade_manual: null, valor_unit_manual: null }]);
    setServicoId('');
  }

  return (
    <Acordeao titulo="Staff" resumo={formatMoney(total)} aberto={staff.length > 0}>
      {staff.length === 0 ? (
        <p class="vazio">Nenhum profissional incluído.</p>
      ) : (
        <table class="tabela-orc">
          <thead>
            <tr>
              <th>Função</th>
              <th>Regra ({convidados} convidados)</th>
              <th class="num">Qtd.</th>
              <th class="num">Valor unit.</th>
              <th class="num">Subtotal</th>
              {!disabled && <th />}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.key}>
                <td><strong>{s.funcao}</strong></td>
                <td class="muted">{descreverRegra(s.regra)}</td>
                <td class="num">
                  <Numero label={`Quantidade de ${s.funcao}`} valor={s.quantidade_manual} calculado={s.quantidade_calc} permitirVazio disabled={disabled} onChange={(v) => atualizar(s.key, { quantidade_manual: v })} />
                </td>
                <td class="num">
                  <ValorManual label={`Valor unitário de ${s.funcao}`} manual={s.valor_unit_manual} calculado={s.valor_unit_calc} disabled={disabled} compacto onChange={(v) => atualizar(s.key, { valor_unit_manual: v })} />
                </td>
                <td class="num"><strong>{formatMoney(s.subtotal_calc ?? 0)}</strong></td>
                {!disabled && (
                  <td class="num">
                    <button type="button" class="remover" aria-label={`Remover ${s.funcao}`} onClick={() => onChange(staff.filter((x) => x.key !== s.key))}><Icon name="close" size={18} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!disabled && (
        <div class="adicionar-linha">
          <select class="control" value={servicoId} onChange={(e) => setServicoId(e.currentTarget.value)} aria-label="Função a adicionar">
            <option value="">Adicionar função do staff…</option>
            {catalogo.servicos.map((s) => (
              <option value={s.id}>{s.funcao} · {descreverRegra(s.regra)}</option>
            ))}
          </select>
          <button type="button" class="btn btn-primary btn-md" onClick={adicionar} disabled={!servicoId}>Adicionar função</button>
        </div>
      )}
    </Acordeao>
  );
}

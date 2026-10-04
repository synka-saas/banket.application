// Acordeão "Staff": funções calculadas pelas regras de Serviços e custos, com ajuste manual.
import { formatMoney } from '../../lib/money';
import { descreverRegra } from '../../lib/calculo/staff';
import { novaChave, type StaffOrcamento } from '../../lib/calculo/orcamento';
import type { CatalogoConstrutor } from '../../server/orcamento';
import { Acordeao, AdicionarBusca, Numero, ValorManual, useRemoverComDesfazer } from './controles';
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
  const remover = useRemoverComDesfazer(staff, onChange);
  const atualizar = (key: string, patch: Partial<StaffOrcamento>) =>
    onChange(staff.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  function adicionar(servicoId: string) {
    const s = catalogo.servicos.find((x) => x.id === servicoId);
    if (!s) return;
    onChange([...staff, { key: novaChave('s'), servico_id: s.id, funcao: s.funcao, regra: s.regra, quantidade_manual: null, valor_unit_manual: null }]);
  }

  return (
    <Acordeao titulo="Staff" icone="users-group" resumo={formatMoney(total)} aberto={staff.length > 0}>
      {staff.length === 0 ? (
        <p class="vazio">Nenhum profissional incluído.</p>
      ) : (
        <div class="tabela-orc-rolagem"><table class="tabela-orc">
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
                    <button type="button" class="remover" aria-label={`Remover ${s.funcao}`} onClick={() => remover(s, s.funcao)}><Icon name="x" size={18} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {!disabled && (
        <div class="adicionar-linha">
          <AdicionarBusca
            rotulo="Adicionar função"
            opcoes={catalogo.servicos.map((s) => ({ valor: s.id, rotulo: s.funcao, detalhe: descreverRegra(s.regra) }))}
            onEscolher={adicionar}
            vazio="Nenhuma função cadastrada em Staff › Serviços e custos."
          />
        </div>
      )}
    </Acordeao>
  );
}

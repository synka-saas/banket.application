// Acordeão "Bebidas": pacotes por pessoa (seções com preço) e itens avulsos por unidade.
import { formatMoney } from '../../lib/money';
import { novaChave, type BebidaOrcamento } from '../../lib/calculo/orcamento';
import type { CatalogoConstrutor } from '../../server/orcamento';
import { Acordeao, AdicionarBusca, Numero, ValorManual, useRemoverComDesfazer } from './controles';
import { Icon } from '../ui/Icon';

interface Props {
  bebidas: BebidaOrcamento[];
  catalogo: CatalogoConstrutor;
  equivalentes: number;
  total: number;
  disabled: boolean;
  onChange: (bebidas: BebidaOrcamento[]) => void;
}

export default function Bebidas({ bebidas, catalogo, equivalentes, total, disabled, onChange }: Props) {
  const remover = useRemoverComDesfazer(bebidas, onChange);
  const secoes = catalogo.secoes.filter((s) => s.bebida);

  const atualizar = (key: string, patch: Partial<BebidaOrcamento>) =>
    onChange(bebidas.map((b) => (b.key === key ? { ...b, ...patch } : b)));

  function adicionar(escolha: string) {
    const [tipo, id] = escolha.split(':');
    if (tipo === 'secao') {
      const s = secoes.find((x) => x.id === id);
      if (!s) return;
      onChange([
        ...bebidas,
        {
          key: novaChave('b'), ref_id: s.id, nome: s.nome, descricao: s.itens.map((i) => i.nome).join(', ') || s.descricao,
          unidade: s.unidade, quantidade: s.unidade === 'unidade' ? 1 : 0, preco_catalogo: s.preco, preco_manual: null, subtotal_manual: null,
        },
      ]);
    } else if (tipo === 'item') {
      const item = secoes.flatMap((s) => s.itens).find((i) => i.id === id);
      if (!item) return;
      onChange([
        ...bebidas,
        {
          key: novaChave('b'), ref_id: item.id, nome: item.nome, descricao: item.descricao, unidade: item.unidade,
          quantidade: item.unidade === 'unidade' ? 1 : 0, preco_catalogo: item.preco, preco_manual: null, subtotal_manual: null,
        },
      ]);
    } else if (tipo === 'custom') {
      onChange([
        ...bebidas,
        { key: novaChave('b'), ref_id: null, nome: 'Bebida', descricao: null, unidade: 'unidade', quantidade: 1, preco_catalogo: null, preco_manual: null, subtotal_manual: null },
      ]);
    }
  }

  return (
    <Acordeao titulo="Bebidas" icone="glass-full" resumo={formatMoney(total)} aberto={bebidas.length > 0}>
      {bebidas.length === 0 ? (
        <p class="vazio">Nenhuma bebida incluída.</p>
      ) : (
        <div class="tabela-orc-rolagem"><table class="tabela-orc">
          <thead>
            <tr>
              <th>Bebida</th>
              <th>Cobrança</th>
              <th class="num">Qtd.</th>
              <th class="num">Valor unit.</th>
              <th class="num">Subtotal</th>
              {!disabled && <th />}
            </tr>
          </thead>
          <tbody>
            {bebidas.map((b) => (
              <tr key={b.key}>
                <td>
                  {disabled || b.ref_id ? (
                    <strong>{b.nome}</strong>
                  ) : (
                    <input class="control compacto" value={b.nome} aria-label="Nome da bebida" onBlur={(e) => atualizar(b.key, { nome: e.currentTarget.value.trim() || 'Bebida' })} />
                  )}
                  {b.descricao && <small class="descricao">{b.descricao}</small>}
                </td>
                <td>
                  <select class="control compacto" value={b.unidade} disabled={disabled} aria-label={`Cobrança de ${b.nome}`} onChange={(e) => atualizar(b.key, { unidade: e.currentTarget.value as 'pessoa' | 'unidade' })}>
                    <option value="pessoa">por pessoa</option>
                    <option value="unidade">por unidade</option>
                  </select>
                </td>
                <td class="num">
                  {b.unidade === 'pessoa' ? (
                    <span class="muted">{equivalentes.toLocaleString('pt-BR')}</span>
                  ) : (
                    <Numero label={`Quantidade de ${b.nome}`} valor={b.quantidade} min={0} disabled={disabled} onChange={(v) => atualizar(b.key, { quantidade: v ?? 0 })} />
                  )}
                </td>
                <td class="num">
                  <ValorManual label={`Valor unitário de ${b.nome}`} manual={b.preco_manual} calculado={b.preco_catalogo} disabled={disabled} compacto onChange={(v) => atualizar(b.key, { preco_manual: v })} />
                </td>
                <td class="num">
                  <ValorManual label={`Subtotal de ${b.nome}`} manual={b.subtotal_manual} calculado={b.subtotal_calc} disabled={disabled} compacto onChange={(v) => atualizar(b.key, { subtotal_manual: v })} />
                </td>
                {!disabled && (
                  <td class="num">
                    <button type="button" class="remover" aria-label={`Remover ${b.nome}`} onClick={() => remover(b, b.nome)}><Icon name="x" size={18} /></button>
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
            rotulo="Adicionar bebida"
            opcoes={[
              ...secoes.flatMap((s) =>
                s.preco !== null
                  ? [{ valor: `secao:${s.id}`, rotulo: `Pacote ${s.nome}`, detalhe: `${formatMoney(s.preco)} ${s.unidade === 'pessoa' ? '/pessoa' : '/unid.'}`, grupo: s.nome }]
                  : s.itens.map((i) => ({
                      valor: `item:${i.id}`,
                      rotulo: i.nome,
                      detalhe: i.preco !== null ? `${formatMoney(i.preco)}${i.unidade === 'pessoa' ? '/pessoa' : '/unid.'}` : undefined,
                      grupo: s.nome,
                    }))
              ),
              { valor: 'custom', rotulo: 'Bebida avulsa (valor manual)', grupo: 'Outro' },
            ]}
            onEscolher={adicionar}
          />
        </div>
      )}
    </Acordeao>
  );
}

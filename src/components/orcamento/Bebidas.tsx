// Acordeão "Bebidas": pacotes por pessoa (sessões com preço) e itens avulsos por unidade.
import { useState } from 'preact/hooks';
import { formatMoney } from '../../lib/money';
import { novaChave, type BebidaOrcamento } from '../../lib/calculo/orcamento';
import type { CatalogoConstrutor } from '../../server/orcamento';
import { Acordeao, Numero, ValorManual } from './controles';
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
  const [escolha, setEscolha] = useState('');
  const secoes = catalogo.secoes.filter((s) => s.bebida);

  const atualizar = (key: string, patch: Partial<BebidaOrcamento>) =>
    onChange(bebidas.map((b) => (b.key === key ? { ...b, ...patch } : b)));

  function adicionar() {
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
    setEscolha('');
  }

  return (
    <Acordeao titulo="Bebidas" icone="local_bar" resumo={formatMoney(total)} aberto={bebidas.length > 0}>
      {bebidas.length === 0 ? (
        <p class="vazio">Nenhuma bebida incluída.</p>
      ) : (
        <table class="tabela-orc">
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
                    <button type="button" class="remover" aria-label={`Remover ${b.nome}`} onClick={() => onChange(bebidas.filter((x) => x.key !== b.key))}><Icon name="close" size={18} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!disabled && (
        <div class="adicionar-linha">
          <select class="control" value={escolha} onChange={(e) => setEscolha(e.currentTarget.value)} aria-label="Bebida a adicionar">
            <option value="">Escolha uma bebida ou pacote…</option>
            {secoes.map((s) => (
              <optgroup label={s.nome}>
                {s.preco !== null && <option value={`secao:${s.id}`}>Pacote {s.nome} · {formatMoney(s.preco)} {s.unidade === 'pessoa' ? '/pessoa' : '/unid.'}</option>}
                {s.preco === null &&
                  s.itens.map((i) => (
                    <option value={`item:${i.id}`}>{i.nome}{i.preco !== null ? ` · ${formatMoney(i.preco)}${i.unidade === 'pessoa' ? '/pessoa' : '/unid.'}` : ''}</option>
                  ))}
              </optgroup>
            ))}
            <option value="custom">+ Bebida avulsa (valor manual)</option>
          </select>
          <button type="button" class="btn btn-primary btn-md" onClick={adicionar} disabled={!escolha}>Adicionar bebida</button>
        </div>
      )}
    </Acordeao>
  );
}

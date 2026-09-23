// Acordeão "Cardápios": cardápios vindos de opções prontas ou montados do zero, com sessões e itens.
import { useState } from 'preact/hooks';
import { formatMoney } from '../../lib/money';
import { novaChave, precoSecao, type CardapioOrcamento, type ItemOrcamento, type SecaoOrcamento } from '../../lib/calculo/orcamento';
import type { CatalogoConstrutor } from '../../server/orcamento';
import { Acordeao, ValorManual } from './controles';
import { Icon } from '../ui/Icon';

type SecaoCatalogo = CatalogoConstrutor['secoes'][number];

interface Props {
  cardapios: CardapioOrcamento[];
  catalogo: CatalogoConstrutor;
  equivalentes: number;
  total: number;
  disabled: boolean;
  onChange: (cardapios: CardapioOrcamento[]) => void;
}

function itemDoCatalogo(i: SecaoCatalogo['itens'][number], comPreco: boolean, selecionado = true): ItemOrcamento {
  return {
    key: novaChave('i'),
    item_id: i.id,
    nome: i.nome,
    descricao: i.descricao,
    selecionado,
    preco_catalogo: comPreco ? i.preco : null,
    preco_manual: null,
    restricoes: i.restricoes ?? [],
  };
}

/** Sessão inteira do catálogo, com os preços do catálogo (acréscimo ao cardápio). */
function secaoDoCatalogo(s: SecaoCatalogo): SecaoOrcamento {
  return {
    key: novaChave('s'),
    secao_id: s.id,
    nome: s.nome,
    escolha_qtd: null,
    preco_catalogo: s.preco,
    preco_manual: null,
    itens: s.itens.map((i) => itemDoCatalogo(i, s.preco === null)),
  };
}

export default function Cardapios({ cardapios, catalogo, equivalentes, total, disabled, onChange }: Props) {
  const [adicionando, setAdicionando] = useState('');
  const secoesComida = catalogo.secoes.filter((s) => !s.bebida);
  const secaoPorId = new Map(catalogo.secoes.map((s) => [s.id, s]));

  const atualizar = (key: string, patch: Partial<CardapioOrcamento>) =>
    onChange(cardapios.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const atualizarSecao = (c: CardapioOrcamento, secaoKey: string, patch: Partial<SecaoOrcamento>) =>
    atualizar(c.key, { secoes: c.secoes.map((s) => (s.key === secaoKey ? { ...s, ...patch } : s)) });

  function adicionarCardapio() {
    if (!adicionando) return;
    if (adicionando === 'zero') {
      onChange([
        ...cardapios,
        { key: novaChave('c'), opcao_id: null, nome: 'Novo cardápio', preco_base: null, preco_pp_manual: null, subtotal_manual: null, secoes: [] },
      ]);
    } else {
      const opcao = catalogo.opcoes.find((o) => o.id === adicionando);
      if (!opcao) return;
      // Itens da opção pronta estão incluídos no preço base: entram sem preço próprio
      const secoes: SecaoOrcamento[] = opcao.secoes.flatMap((os) => {
        const s = secaoPorId.get(os.secao_id);
        if (!s) return [];
        const itens = os.itens.map((id) => s.itens.find((i) => i.id === id)).filter((i): i is SecaoCatalogo['itens'][number] => Boolean(i));
        return [{
          key: novaChave('s'),
          secao_id: s.id,
          nome: os.titulo ?? s.nome,
          escolha_qtd: os.escolha_qtd,
          preco_catalogo: os.preco,
          preco_manual: null,
          itens: itens.map((i) => itemDoCatalogo(i, false)),
        }];
      });
      onChange([
        ...cardapios,
        { key: novaChave('c'), opcao_id: opcao.id, nome: opcao.nome, preco_base: opcao.preco_por_pessoa, preco_pp_manual: null, subtotal_manual: null, secoes },
      ]);
    }
    setAdicionando('');
  }

  return (
    <Acordeao titulo="Cardápios" icone="hand_meal" resumo={formatMoney(total)}>
      {cardapios.length === 0 && <p class="vazio">Nenhum cardápio. Adicione uma opção pronta ou monte um do zero.</p>}

      {cardapios.map((c) => (
        <CardapioBloco
          key={c.key}
          cardapio={c}
          secoesComida={secoesComida}
          secaoPorId={secaoPorId}
          equivalentes={equivalentes}
          disabled={disabled}
          onChange={(patch) => atualizar(c.key, patch)}
          onSecao={(secaoKey, patch) => atualizarSecao(c, secaoKey, patch)}
          onRemover={() => window.confirm(`Remover o cardápio "${c.nome}"?`) && onChange(cardapios.filter((x) => x.key !== c.key))}
        />
      ))}

      {!disabled && (
        <div class="adicionar-linha">
          <select class="control" value={adicionando} onChange={(e) => setAdicionando(e.currentTarget.value)} aria-label="Cardápio a adicionar">
            <option value="">Escolha uma opção de cardápio…</option>
            {catalogo.opcoes.map((o) => (
              <option value={o.id}>{o.nome}{o.preco_por_pessoa !== null ? ` · ${formatMoney(o.preco_por_pessoa)}/pessoa` : ''}</option>
            ))}
            <option value="zero">+ Montar cardápio do zero</option>
          </select>
          <button type="button" class="btn btn-primary btn-md" onClick={adicionarCardapio} disabled={!adicionando}>
            <Icon name="add_circle" size={18} /> Adicionar cardápio
          </button>
        </div>
      )}
    </Acordeao>
  );
}

function CardapioBloco(props: {
  cardapio: CardapioOrcamento;
  secoesComida: SecaoCatalogo[];
  secaoPorId: Map<string, SecaoCatalogo>;
  equivalentes: number;
  disabled: boolean;
  onChange: (patch: Partial<CardapioOrcamento>) => void;
  onSecao: (secaoKey: string, patch: Partial<SecaoOrcamento>) => void;
  onRemover: () => void;
}) {
  const { cardapio: c, disabled } = props;
  const [aberto, setAberto] = useState(true);
  const [novaSecao, setNovaSecao] = useState('');
  const pp = c.preco_pp_manual ?? c.preco_pp_calc ?? 0;
  const subtotal = c.subtotal_manual ?? c.subtotal_calc ?? 0;

  function adicionarSecao() {
    const s = props.secaoPorId.get(novaSecao);
    if (!s) return;
    props.onChange({ secoes: [...c.secoes, secaoDoCatalogo(s)] });
    setNovaSecao('');
  }

  return (
    <article class="cardapio">
      <header class="cardapio-barra">
        <button type="button" class="cardapio-toggle" onClick={() => setAberto(!aberto)} aria-expanded={aberto} aria-label={`Recolher ${c.nome}`}>
          <Icon name={aberto ? 'unfold_less' : 'unfold_more'} size={20} />
        </button>
        {disabled ? (
          <strong class="cardapio-nome">{c.nome}</strong>
        ) : (
          <input class="cardapio-nome" value={c.nome} aria-label="Nome do cardápio" maxLength={200} onBlur={(e) => e.currentTarget.value.trim() && props.onChange({ nome: e.currentTarget.value.trim() })} />
        )}
        <span class="cardapio-subtotal">
          {props.equivalentes.toLocaleString('pt-BR')} × {formatMoney(pp)} = <strong>{formatMoney(subtotal)}</strong>
        </span>
      </header>

      {aberto && (
        <div class="cardapio-corpo">
          <div class="cardapio-precos">
            <label>
              Preço base (opção)
              <ValorManual label={`Preço base de ${c.nome}`} manual={c.preco_base} onChange={(v) => props.onChange({ preco_base: v })} disabled={disabled} compacto simples placeholder="sem preço" />
            </label>
            <label>
              Preço por pessoa
              <ValorManual label={`Preço por pessoa de ${c.nome}`} manual={c.preco_pp_manual} calculado={c.preco_pp_calc} onChange={(v) => props.onChange({ preco_pp_manual: v })} disabled={disabled} compacto />
            </label>
            <label>
              Subtotal
              <ValorManual label={`Subtotal de ${c.nome}`} manual={c.subtotal_manual} calculado={c.subtotal_calc} onChange={(v) => props.onChange({ subtotal_manual: v })} disabled={disabled} compacto />
            </label>
            {!disabled && (
              <button type="button" class="link-perigo" onClick={props.onRemover}>Remover cardápio</button>
            )}
          </div>

          {c.secoes.map((s) => (
            <SecaoBloco
              key={s.key}
              secao={s}
              catalogo={s.secao_id ? props.secaoPorId.get(s.secao_id) : undefined}
              disabled={disabled}
              onChange={(patch) => props.onSecao(s.key, patch)}
              onRemover={() => props.onChange({ secoes: c.secoes.filter((x) => x.key !== s.key) })}
            />
          ))}

          {!disabled && (
            <div class="adicionar-linha">
              <select class="control" value={novaSecao} onChange={(e) => setNovaSecao(e.currentTarget.value)} aria-label={`Sessão a adicionar em ${c.nome}`}>
                <option value="">Adicionar sessão do catálogo…</option>
                {props.secoesComida.map((s) => (
                  <option value={s.id}>{s.nome}{s.preco !== null ? ` · ${formatMoney(s.preco)}/pessoa` : ''}</option>
                ))}
              </select>
              <button type="button" class="btn btn-dark btn-md" onClick={adicionarSecao} disabled={!novaSecao}>
                <Icon name="add_circle" size={18} /> Adicionar nova sessão ao cardápio
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SecaoBloco(props: {
  secao: SecaoOrcamento;
  catalogo: SecaoCatalogo | undefined;
  disabled: boolean;
  onChange: (patch: Partial<SecaoOrcamento>) => void;
  onRemover: () => void;
}) {
  const { secao: s, disabled } = props;
  const [novoItem, setNovoItem] = useState('');
  const presentes = new Set(s.itens.map((i) => i.item_id));
  const disponiveis = props.catalogo?.itens.filter((i) => !presentes.has(i.id)) ?? [];
  const preco = precoSecao(s);
  const selecionados = s.itens.filter((i) => i.selecionado).length;

  const alternar = (key: string) =>
    props.onChange({ itens: s.itens.map((i) => (i.key === key ? { ...i, selecionado: !i.selecionado } : i)) });

  function adicionarItem() {
    if (novoItem === 'custom') {
      const nome = window.prompt('Nome do item personalizado:')?.trim();
      if (nome) {
        props.onChange({
          itens: [...s.itens, { key: novaChave('i'), item_id: null, nome, descricao: null, selecionado: true, preco_catalogo: null, preco_manual: null, restricoes: [] }],
        });
      }
    } else {
      const item = props.catalogo?.itens.find((i) => i.id === novoItem);
      if (item) props.onChange({ itens: [...s.itens, itemDoCatalogo(item, true)] });
    }
    setNovoItem('');
  }

  return (
    <div class="secao-orc">
      <div class="secao-orc-cabecalho">
        <span class="secao-orc-nome"><Icon name="radio_button_checked" size={16} /> {s.nome}</span>
        {s.escolha_qtd && (
          <span class={`escolha ${selecionados < s.escolha_qtd ? 'alerta' : ''}`}>
            Cliente escolhe {s.escolha_qtd}
          </span>
        )}
        {preco > 0 && <span class="secao-orc-preco">+ {formatMoney(preco)}/pessoa</span>}
        {!disabled && (
          <>
            <ValorManual label={`Preço da sessão ${s.nome}`} manual={s.preco_manual} calculado={s.preco_catalogo ?? (preco || null)} onChange={(v) => props.onChange({ preco_manual: v })} compacto placeholder="sem preço" />
            <button type="button" class="link-perigo" onClick={props.onRemover} aria-label={`Remover sessão ${s.nome}`}>Remover</button>
          </>
        )}
      </div>
      <div class="chip-group">
        {s.itens.map((i) => (
          <label class="chip" key={i.key} title={i.descricao ?? undefined}>
            <input type="checkbox" checked={i.selecionado} disabled={disabled} onChange={() => alternar(i.key)} />
            {i.nome}
            {(i.preco_manual ?? i.preco_catalogo) !== null && <span class="chip-preco">{formatMoney(i.preco_manual ?? i.preco_catalogo)}</span>}
          </label>
        ))}
      </div>
      {!disabled && (
        <div class="adicionar-item">
          <select class="control compacto" value={novoItem} onChange={(e) => setNovoItem(e.currentTarget.value)} aria-label={`Item a adicionar em ${s.nome}`}>
            <option value="">+ Adicionar item…</option>
            {disponiveis.map((i) => (
              <option value={i.id}>{i.nome}{i.preco !== null ? ` · ${formatMoney(i.preco)}` : ''}</option>
            ))}
            <option value="custom">Item personalizado…</option>
          </select>
          {novoItem && <button type="button" class="btn btn-outline btn-sm" onClick={adicionarItem}>Adicionar</button>}
        </div>
      )}
    </div>
  );
}

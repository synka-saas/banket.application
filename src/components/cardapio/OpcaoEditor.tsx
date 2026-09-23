// Editor de opção de cardápio (pacote): nome, preço base, duração, formato, tags e sessões com itens.
// Abre ao clicar em qualquer elemento [data-opcao-editar="<id>"] (vazio = nova opção).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { moneyInput, parseMoney } from '../../lib/money';
import { Icon } from '../ui/Icon';
import '../../styles/editor.css';

interface CatalogoItem {
  id: string;
  nome: string;
  ativo: boolean;
}

interface CatalogoSecao {
  id: string;
  nome: string;
  itens: CatalogoItem[];
}

interface Props {
  catalogo: CatalogoSecao[];
  formatos: { id: string; nome: string }[];
}

interface SecaoState {
  key: string;
  secao_id: string;
  titulo: string;
  escolha_qtd: string;
  itens: string[];
}

interface FormState {
  id: string | null;
  nome: string;
  descricao: string;
  preco_por_pessoa: string;
  duracao_horas: string;
  formato_servico_id: string;
  tags: string;
  ativo: boolean;
  secoes: SecaoState[];
}

const vazio: FormState = {
  id: null,
  nome: '',
  descricao: '',
  preco_por_pessoa: '',
  duracao_horas: '',
  formato_servico_id: '',
  tags: '',
  ativo: true,
  secoes: [],
};

let seq = 0;
const novaChave = () => `s${++seq}`;

function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  (window as unknown as { banketToast?: (m: string, t: string) => void }).banketToast?.(message, type);
}

export default function OpcaoEditor({ catalogo, formatos }: Props) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<FormState>(vazio);
  const [novaSecao, setNovaSecao] = useState('');

  const secoesPorId = useMemo(() => new Map(catalogo.map((s) => [s.id, s])), [catalogo]);

  async function abrir(id: string | null) {
    setNovaSecao('');
    setAberto(true);
    if (!id) {
      setForm(vazio);
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch(`/api/cardapio/opcoes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({
        id: data.id,
        nome: data.nome,
        descricao: data.descricao ?? '',
        preco_por_pessoa: moneyInput(data.preco_por_pessoa),
        duracao_horas: data.duracao_horas === null ? '' : String(data.duracao_horas).replace('.', ','),
        formato_servico_id: data.formato_servico_id ?? '',
        tags: (data.tags ?? []).join(', '),
        ativo: data.ativo,
        secoes: data.secoes.map((s: { secao_id: string; titulo: string | null; escolha_qtd: number | null; itens: string[] }) => ({
          key: novaChave(),
          secao_id: s.secao_id,
          titulo: s.titulo ?? '',
          escolha_qtd: s.escolha_qtd === null ? '' : String(s.escolha_qtd),
          itens: s.itens,
        })),
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível carregar o cardápio.', 'error');
      setAberto(false);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-opcao-editar]');
      if (!el) return;
      e.preventDefault();
      abrir(el.dataset.opcaoEditar || null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const set = <K extends keyof FormState>(campo: K, valor: FormState[K]) => setForm((f) => ({ ...f, [campo]: valor }));

  const setSecao = (key: string, patch: Partial<SecaoState>) =>
    setForm((f) => ({ ...f, secoes: f.secoes.map((s) => (s.key === key ? { ...s, ...patch } : s)) }));

  function adicionarSecao() {
    const secao = secoesPorId.get(novaSecao);
    if (!secao) {
      toast('Escolha uma sessão do catálogo para adicionar.', 'info');
      return;
    }
    setForm((f) => ({
      ...f,
      secoes: [
        ...f.secoes,
        { key: novaChave(), secao_id: secao.id, titulo: '', escolha_qtd: '', itens: secao.itens.filter((i) => i.ativo).map((i) => i.id) },
      ],
    }));
    setNovaSecao('');
  }

  function moverSecao(key: string, delta: number) {
    setForm((f) => {
      const i = f.secoes.findIndex((s) => s.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= f.secoes.length) return f;
      const secoes = [...f.secoes];
      [secoes[i], secoes[j]] = [secoes[j], secoes[i]];
      return { ...f, secoes };
    });
  }

  function alternarItem(secao: SecaoState, itemId: string) {
    const itens = secao.itens.includes(itemId) ? secao.itens.filter((i) => i !== itemId) : [...secao.itens, itemId];
    setSecao(secao.key, { itens });
  }

  async function enviar(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown) {
    setSalvando(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar.');
      window.location.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error');
      setSalvando(false);
    }
  }

  function salvar(e: Event) {
    e.preventDefault();
    const preco = parseMoney(form.preco_por_pessoa);
    if (Number.isNaN(preco)) return toast('Preço por pessoa inválido.', 'error');
    const payload = {
      nome: form.nome,
      descricao: form.descricao,
      preco_por_pessoa: preco,
      duracao_horas: form.duracao_horas,
      formato_servico_id: form.formato_servico_id,
      tags: form.tags,
      ativo: form.ativo,
      secoes: form.secoes.map((s) => ({
        secao_id: s.secao_id,
        titulo: s.titulo,
        escolha_qtd: s.escolha_qtd,
        itens: s.itens,
      })),
    };
    enviar(form.id ? 'PUT' : 'POST', form.id ? `/api/cardapio/opcoes/${form.id}` : '/api/cardapio/opcoes', payload);
  }

  function excluir() {
    if (form.id && window.confirm(`Excluir o cardápio "${form.nome}"?`)) enviar('DELETE', `/api/cardapio/opcoes/${form.id}`);
  }

  function duplicar() {
    if (form.id) enviar('POST', `/api/cardapio/opcoes/${form.id}`);
  }

  if (!aberto) return null;

  const totalItens = form.secoes.reduce((acc, s) => acc + s.itens.length, 0);

  return (
    <div class="ed-backdrop" onClick={(e) => e.target === e.currentTarget && setAberto(false)}>
      <form class="ed-drawer" onSubmit={salvar} aria-label="Editar cardápio">
        <header class="ed-header">
          <input
            class="ed-title"
            value={form.nome}
            onInput={(e) => set('nome', e.currentTarget.value)}
            placeholder="Nome do cardápio"
            aria-label="Nome do cardápio"
            required
            maxLength={150}
          />
          <div class="ed-actions">
            {form.id && (
              <>
                <button type="button" class="btn btn-outline btn-md" onClick={duplicar} disabled={salvando}>Duplicar</button>
                <button type="button" class="btn btn-outline btn-md" onClick={excluir} disabled={salvando}>Excluir</button>
              </>
            )}
            <button type="submit" class="btn btn-success btn-md" disabled={salvando || carregando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" class="ed-close" onClick={() => setAberto(false)} aria-label="Fechar"><Icon name="close" size={24} /></button>
          </div>
        </header>

        {carregando ? (
          <div class="ed-body ed-loading">Carregando…</div>
        ) : (
          <div class="ed-body">
            <div class="ed-row">
              <div class="field">
                <label for="op-preco">Preço base por pessoa</label>
                <input id="op-preco" inputMode="decimal" placeholder="R$ 00,00" value={form.preco_por_pessoa} onInput={(e) => set('preco_por_pessoa', e.currentTarget.value)} />
              </div>
              <div class="field">
                <label for="op-duracao">Duração do serviço (horas)</label>
                <input id="op-duracao" inputMode="decimal" placeholder="00 horas" value={form.duracao_horas} onInput={(e) => set('duracao_horas', e.currentTarget.value)} />
              </div>
              <div class="field">
                <label for="op-formato">Formato de serviço</label>
                <select id="op-formato" value={form.formato_servico_id} onChange={(e) => set('formato_servico_id', e.currentTarget.value)}>
                  <option value="">Selecione…</option>
                  {formatos.map((f) => <option value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            </div>

            <div class="ed-row ed-row-2">
              <div class="field">
                <label for="op-desc">Descrição</label>
                <input id="op-desc" value={form.descricao} onInput={(e) => set('descricao', e.currentTarget.value)} placeholder="Resumo exibido no card" maxLength={2000} />
              </div>
              <div class="field">
                <label for="op-tags">Tags</label>
                <input id="op-tags" value={form.tags} onInput={(e) => set('tags', e.currentTarget.value)} placeholder="Separadas por vírgula (ex.: Casamento, Buffet)" />
              </div>
            </div>

            <div class="ed-add">
              <select class="control" value={novaSecao} onChange={(e) => setNovaSecao(e.currentTarget.value)} aria-label="Sessão do catálogo">
                <option value="">Escolha uma sessão do catálogo…</option>
                {catalogo.map((s) => <option value={s.id}>{s.nome} ({s.itens.length} itens)</option>)}
              </select>
              <button type="button" class="btn btn-primary btn-md" onClick={adicionarSecao}>
                <Icon name="add_circle" size={18} /> Adicionar sessão
              </button>
            </div>

            <p class="ed-summary">
              {form.secoes.length} sessão(ões) · {totalItens} item(ns)
            </p>

            {form.secoes.length === 0 && <div class="ed-empty">Adicione sessões do catálogo para montar o cardápio.</div>}

            {form.secoes.map((s, idx) => {
              const secao = secoesPorId.get(s.secao_id);
              const itens = secao?.itens ?? [];
              const escolha = Number(s.escolha_qtd);
              const alerta = s.escolha_qtd && escolha > s.itens.length;
              return (
                <section class="ed-secao" key={s.key}>
                  <header class="ed-secao-header">
                    <div class="ed-secao-nome">
                      <strong>{secao?.nome ?? 'Sessão removida'}</strong>
                      <input
                        class="ed-inline"
                        value={s.titulo}
                        onInput={(e) => setSecao(s.key, { titulo: e.currentTarget.value })}
                        placeholder="Exibir como… (opcional)"
                        aria-label="Título exibido na proposta"
                        maxLength={120}
                      />
                    </div>
                    <label class="ed-escolha">
                      Cliente escolhe
                      <input
                        type="number"
                        min={1}
                        value={s.escolha_qtd}
                        onInput={(e) => setSecao(s.key, { escolha_qtd: e.currentTarget.value })}
                        placeholder="todos"
                        aria-label="Quantidade de itens que o cliente escolhe"
                      />
                    </label>
                    <div class="ed-secao-actions">
                      <button type="button" onClick={() => moverSecao(s.key, -1)} disabled={idx === 0} aria-label="Mover para cima"><Icon name="keyboard_arrow_up" size={18} /></button>
                      <button type="button" onClick={() => moverSecao(s.key, 1)} disabled={idx === form.secoes.length - 1} aria-label="Mover para baixo"><Icon name="keyboard_arrow_down" size={18} /></button>
                      <button type="button" class="ed-remover" onClick={() => setForm((f) => ({ ...f, secoes: f.secoes.filter((x) => x.key !== s.key) }))}>
                        <Icon name="do_not_disturb_on" size={18} /> Remover
                      </button>
                    </div>
                  </header>
                  <div class="ed-secao-body">
                    <div class="chip-group">
                      {itens.map((item) => (
                        <label class={`chip ${item.ativo ? '' : 'chip-inativo'}`} key={item.id}>
                          <input type="checkbox" checked={s.itens.includes(item.id)} onChange={() => alternarItem(s, item.id)} />
                          {item.nome}
                        </label>
                      ))}
                    </div>
                    <div class="ed-secao-footer">
                      <button type="button" class="ed-link" onClick={() => setSecao(s.key, { itens: itens.map((i) => i.id) })}>Marcar todos</button>
                      <button type="button" class="ed-link" onClick={() => setSecao(s.key, { itens: [] })}>Desmarcar todos</button>
                      {alerta && <span class="ed-alerta">A sessão tem menos itens do que o cliente deve escolher.</span>}
                    </div>
                  </div>
                </section>
              );
            })}

            <label class="switch ed-ativo">
              <input type="checkbox" checked={form.ativo} onChange={(e) => set('ativo', e.currentTarget.checked)} />
              Cardápio ativo (disponível para novos orçamentos)
            </label>
          </div>
        )}
      </form>
    </div>
  );
}

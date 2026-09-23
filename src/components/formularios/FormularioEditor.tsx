// Editor de formulário de captação: dados gerais, sessões (ativar/desativar) e perguntas
// (ativar/desativar as padrão, reordenar e incluir perguntas personalizadas em cada sessão).
import { useEffect, useState } from 'preact/hooks';
import {
  TIPOS_COM_OPCOES,
  TIPOS_PERGUNTA,
  extrairConfig,
  type PerguntaResolvida,
  type SecaoResolvida,
  type TipoPergunta,
} from '../../lib/formularios/modelo';
import { Icon } from '../ui/Icon';
import '../../styles/formularios.css';

interface Formulario {
  id: string;
  nome: string;
  descricao: string | null;
  slug: string;
  ativo: boolean;
  mensagem_sucesso: string | null;
  secoes: SecaoResolvida[];
}

interface Props {
  formulario: Formulario;
  origem: string;
}

interface Rascunho {
  secao: string;
  /** id da pergunta em edição; null = nova */
  id: string | null;
  rotulo: string;
  tipo: TipoPergunta;
  opcoes: string;
  obrigatoria: boolean;
  placeholder: string;
  ajuda: string;
}

function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  (window as unknown as { banketToast?: (m: string, t: string) => void }).banketToast?.(message, type);
}

const novoId = () => `c_${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`;

export default function FormularioEditor({ formulario, origem }: Props) {
  const [nome, setNome] = useState(formulario.nome);
  const [descricao, setDescricao] = useState(formulario.descricao ?? '');
  const [slug, setSlug] = useState(formulario.slug);
  const [ativo, setAtivo] = useState(formulario.ativo);
  const [mensagem, setMensagem] = useState(formulario.mensagem_sucesso ?? '');
  const [secoes, setSecoes] = useState<SecaoResolvida[]>(formulario.secoes);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);

  const linkPublico = `${origem}/f/${formulario.slug}`;

  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (alterado && !salvando) e.preventDefault();
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [alterado, salvando]);

  const marcar = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setAlterado(true);
  };

  function alterarSecao(chave: string, fn: (s: SecaoResolvida) => SecaoResolvida) {
    setSecoes((lista) => lista.map((s) => (s.chave === chave ? fn(s) : s)));
    setAlterado(true);
  }

  const alterarPergunta = (secao: string, id: string, patch: Partial<PerguntaResolvida>) =>
    alterarSecao(secao, (s) => ({ ...s, perguntas: s.perguntas.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  function mover(secao: string, idx: number, delta: number) {
    alterarSecao(secao, (s) => {
      const j = idx + delta;
      if (j < 0 || j >= s.perguntas.length) return s;
      const perguntas = [...s.perguntas];
      [perguntas[idx], perguntas[j]] = [perguntas[j], perguntas[idx]];
      return { ...s, perguntas };
    });
  }

  function removerPergunta(secao: string, p: PerguntaResolvida) {
    if (!window.confirm(`Remover a pergunta "${p.rotulo}"? As respostas já recebidas continuam guardadas.`)) return;
    alterarSecao(secao, (s) => ({ ...s, perguntas: s.perguntas.filter((x) => x.id !== p.id) }));
  }

  function abrirRascunho(secao: string, p?: PerguntaResolvida) {
    setRascunho({
      secao,
      id: p?.id ?? null,
      rotulo: p?.rotulo ?? '',
      tipo: p?.tipo ?? 'texto',
      opcoes: p && TIPOS_COM_OPCOES.includes(p.tipo) ? p.opcoes.map((o) => o.rotulo).join('\n') : '',
      obrigatoria: p?.obrigatoria ?? false,
      placeholder: p?.placeholder ?? '',
      ajuda: p?.ajuda ?? '',
    });
  }

  function confirmarRascunho() {
    if (!rascunho) return;
    const rotulo = rascunho.rotulo.trim();
    if (!rotulo) return toast('Informe o texto da pergunta.', 'error');
    const comOpcoes = TIPOS_COM_OPCOES.includes(rascunho.tipo);
    const opcoes = comOpcoes
      ? rascunho.opcoes
          .split('\n')
          .map((o) => o.trim())
          .filter((o, i, l) => o && l.indexOf(o) === i)
      : [];
    if (comOpcoes && opcoes.length < 2) return toast('Informe ao menos 2 opções, uma por linha.', 'error');

    const pergunta: PerguntaResolvida = {
      id: rascunho.id ?? novoId(),
      padrao: false,
      rotulo,
      tipo: rascunho.tipo,
      opcoes:
        rascunho.tipo === 'sim_nao'
          ? [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]
          : opcoes.map((o) => ({ valor: o, rotulo: o })),
      placeholder: rascunho.placeholder.trim() || null,
      ajuda: rascunho.ajuda.trim() || null,
      obrigatoria: rascunho.obrigatoria,
      travada: false,
      ativa: true,
      mostrarSe: null,
    };
    alterarSecao(rascunho.secao, (s) => ({
      ...s,
      perguntas: rascunho.id
        ? s.perguntas.map((p) => (p.id === rascunho.id ? { ...pergunta, ativa: p.ativa } : p))
        : [...s.perguntas, pergunta],
    }));
    setRascunho(null);
  }

  async function enviar(method: 'PUT' | 'POST' | 'DELETE', body?: unknown): Promise<{ id?: string } | null> {
    setSalvando(true);
    try {
      const res = await fetch(`/api/formularios/${formulario.id}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar.');
      return data;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error');
      setSalvando(false);
      return null;
    }
  }

  async function salvar(e: Event) {
    e.preventDefault();
    if (rascunho) return toast('Conclua ou cancele a pergunta em edição antes de salvar.', 'info');
    const ok = await enviar('PUT', {
      nome,
      descricao,
      slug,
      ativo,
      mensagem_sucesso: mensagem,
      config: extrairConfig(secoes),
    });
    if (ok) {
      setAlterado(false);
      window.location.reload();
    }
  }

  async function duplicar() {
    if (alterado && !window.confirm('Há alterações não salvas que não irão para a cópia. Continuar?')) return;
    const data = await enviar('POST');
    if (data?.id) window.location.href = `/formularios/${data.id}`;
  }

  async function excluir() {
    if (!window.confirm(`Excluir o formulário "${formulario.nome}"? O link público deixa de funcionar.`)) return;
    const data = await enviar('DELETE');
    if (data) {
      setAlterado(false);
      window.location.href = '/formularios';
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkPublico);
      toast('Link copiado.', 'success');
    } catch {
      toast('Não foi possível copiar. Copie o endereço manualmente.', 'error');
    }
  }

  const rotuloCondicao = (s: SecaoResolvida, p: PerguntaResolvida) => {
    if (!p.mostrarSe) return null;
    const alvo = s.perguntas.find((x) => x.id === p.mostrarSe!.chave);
    const opcao = alvo?.opcoes.find((o) => o.valor === p.mostrarSe!.valor)?.rotulo ?? p.mostrarSe.valor;
    return `Aparece quando "${alvo?.rotulo ?? p.mostrarSe.chave}" = ${opcao}`;
  };

  const ativas = secoes.filter((s) => s.ativa);
  const totalPerguntas = ativas.reduce((acc, s) => acc + s.perguntas.filter((p) => p.ativa).length, 0);

  return (
    <form class="fe" onSubmit={salvar}>
      <section class="fe-card">
        <div class="fe-geral">
          <div class="field">
            <label for="fe-nome">Nome do formulário*</label>
            <input id="fe-nome" value={nome} onInput={(e) => marcar(setNome)(e.currentTarget.value)} required maxLength={120} />
          </div>
          <div class="field">
            <label for="fe-slug">Endereço público*</label>
            <div class="fe-slug">
              <span title={`${origem}/f/`}>/f/</span>
              <input
                id="fe-slug"
                value={slug}
                onInput={(e) => marcar(setSlug)(e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                required
                minLength={3}
                maxLength={80}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title="Letras minúsculas, números e hífens"
              />
            </div>
          </div>
          <div class="field fe-status">
            <span class="field-label">Status</span>
            <label class="switch">
              <input type="checkbox" checked={ativo} onChange={(e) => marcar(setAtivo)(e.currentTarget.checked)} />
              {ativo ? 'Recebendo respostas' : 'Inativo'}
            </label>
          </div>
          <div class="field fe-span">
            <label for="fe-desc">Descrição interna</label>
            <input id="fe-desc" value={descricao} onInput={(e) => marcar(setDescricao)(e.currentTarget.value)} maxLength={1000} placeholder="Onde este formulário é divulgado, para quem é…" />
          </div>
          <div class="field fe-span">
            <label for="fe-msg">Mensagem após o envio</label>
            <textarea
              id="fe-msg"
              value={mensagem}
              onInput={(e) => marcar(setMensagem)(e.currentTarget.value)}
              maxLength={1000}
              rows={3}
              placeholder="Seu pedido foi recebido. Nossa equipe vai analisar e entrar em contato em breve."
            />
          </div>
        </div>
        <div class="fe-link">
          <a class="link" href={linkPublico} target="_blank" rel="noopener">{linkPublico}</a>
          <button type="button" class="row-action" onClick={copiarLink}>Copiar link</button>
          {!formulario.ativo && <span class="fe-aviso">O link só funciona com o formulário ativo.</span>}
        </div>
      </section>

      <p class="fe-resumo">
        {ativas.length} de {secoes.length} sessões ativas · {totalPerguntas} perguntas ativas. As sessões de dimensionamento B2B e B2C aparecem conforme a natureza escolhida pelo cliente.
      </p>

      {secoes.map((s, n) => (
        <section class={`fe-secao ${s.ativa ? '' : 'fe-inativa'}`} key={s.chave} data-secao={s.chave}>
          <header class="fe-secao-header">
            <span class="fe-numero">{n + 1}</span>
            <div class="fe-secao-titulo">
              <strong>{s.titulo}</strong>
              <span>{s.descricao}</span>
            </div>
            {s.fluxo !== 'todos' && <span class="tag">Somente {s.fluxo}</span>}
            {s.travada ? (
              <span class="fe-travada" title="Sessão obrigatória: dados de contato usados para criar o cliente e o evento"><Icon name="lock" size={14} /> Sempre ativa</span>
            ) : (
              <label class="switch">
                <input
                  type="checkbox"
                  checked={s.ativa}
                  aria-label={`Sessão ${s.titulo} ${s.fluxo !== 'todos' ? s.fluxo : ''} ativa`}
                  onChange={(e) => alterarSecao(s.chave, (x) => ({ ...x, ativa: e.currentTarget.checked }))}
                />
                Sessão ativa
              </label>
            )}
          </header>

          <ul class="fe-perguntas">
            {s.perguntas.map((p, idx) => (
              <li class={`fe-pergunta ${p.ativa ? '' : 'fe-off'}`} key={p.id} data-pergunta={p.id}>
                <div class="fe-ordem">
                  <button type="button" onClick={() => mover(s.chave, idx, -1)} disabled={idx === 0} aria-label="Mover para cima"><Icon name="keyboard_arrow_up" size={16} /></button>
                  <button type="button" onClick={() => mover(s.chave, idx, 1)} disabled={idx === s.perguntas.length - 1} aria-label="Mover para baixo"><Icon name="keyboard_arrow_down" size={16} /></button>
                </div>
                <div class="fe-pergunta-info">
                  <span class="fe-rotulo">{p.rotulo}{p.obrigatoria ? ' *' : ''}</span>
                  <span class="fe-meta">
                    {TIPOS_PERGUNTA[p.tipo]}
                    {p.opcoes.length > 0 && p.tipo !== 'sim_nao' ? ` · ${p.opcoes.length} opções` : ''}
                    {!p.padrao && ' · Personalizada'}
                    {rotuloCondicao(s, p) && ` · ${rotuloCondicao(s, p)}`}
                  </span>
                </div>
                {!p.padrao && (
                  <div class="fe-acoes">
                    <button type="button" class="row-action" onClick={() => abrirRascunho(s.chave, p)}>Editar</button>
                    <button type="button" class="row-action danger" onClick={() => removerPergunta(s.chave, p)}>Remover</button>
                  </div>
                )}
                {p.travada ? (
                  <span class="fe-travada" title="Pergunta essencial para criar o cliente e o evento"><Icon name="lock" size={14} /> Obrigatória</span>
                ) : (
                  <>
                    <label class="fe-obrigatoria">
                      <input
                        type="checkbox"
                        checked={p.obrigatoria}
                        disabled={!p.ativa}
                        onChange={(e) => alterarPergunta(s.chave, p.id, { obrigatoria: e.currentTarget.checked })}
                      />
                      Obrigatória
                    </label>
                    <label class="switch" title={p.ativa ? 'Desativar pergunta' : 'Ativar pergunta'}>
                      <input
                        type="checkbox"
                        checked={p.ativa}
                        aria-label={`Pergunta ${p.rotulo} ativa`}
                        onChange={(e) => alterarPergunta(s.chave, p.id, { ativa: e.currentTarget.checked })}
                      />
                    </label>
                  </>
                )}
              </li>
            ))}
          </ul>

          {rascunho?.secao === s.chave ? (
            <div class="fe-rascunho">
              <div class="fe-rascunho-grid">
                <div class="field fe-span">
                  <label for={`fe-r-rotulo-${s.chave}`}>Pergunta*</label>
                  <input
                    id={`fe-r-rotulo-${s.chave}`}
                    value={rascunho.rotulo}
                    onInput={(e) => setRascunho({ ...rascunho, rotulo: e.currentTarget.value })}
                    maxLength={200}
                    placeholder="Ex.: Qual o tema da festa?"
                    autoFocus
                  />
                </div>
                <div class="field">
                  <label for={`fe-r-tipo-${s.chave}`}>Tipo de resposta</label>
                  <select
                    id={`fe-r-tipo-${s.chave}`}
                    value={rascunho.tipo}
                    onChange={(e) => setRascunho({ ...rascunho, tipo: e.currentTarget.value as TipoPergunta })}
                  >
                    {Object.entries(TIPOS_PERGUNTA).map(([valor, rotulo]) => <option value={valor}>{rotulo}</option>)}
                  </select>
                </div>
                <div class="field fe-rascunho-check">
                  <label class="switch">
                    <input type="checkbox" checked={rascunho.obrigatoria} onChange={(e) => setRascunho({ ...rascunho, obrigatoria: e.currentTarget.checked })} />
                    Resposta obrigatória
                  </label>
                </div>
                {TIPOS_COM_OPCOES.includes(rascunho.tipo) && (
                  <div class="field fe-span">
                    <label for={`fe-r-opcoes-${s.chave}`}>Opções (uma por linha)*</label>
                    <textarea
                      id={`fe-r-opcoes-${s.chave}`}
                      rows={4}
                      value={rascunho.opcoes}
                      onInput={(e) => setRascunho({ ...rascunho, opcoes: e.currentTarget.value })}
                      placeholder={'Opção 1\nOpção 2'}
                    />
                  </div>
                )}
                {!TIPOS_COM_OPCOES.includes(rascunho.tipo) && rascunho.tipo !== 'sim_nao' && rascunho.tipo !== 'data' && (
                  <div class="field">
                    <label for={`fe-r-ph-${s.chave}`}>Texto de exemplo</label>
                    <input
                      id={`fe-r-ph-${s.chave}`}
                      value={rascunho.placeholder}
                      onInput={(e) => setRascunho({ ...rascunho, placeholder: e.currentTarget.value })}
                      maxLength={200}
                      placeholder="Aparece dentro do campo vazio"
                    />
                  </div>
                )}
                <div class="field">
                  <label for={`fe-r-ajuda-${s.chave}`}>Texto de ajuda</label>
                  <input
                    id={`fe-r-ajuda-${s.chave}`}
                    value={rascunho.ajuda}
                    onInput={(e) => setRascunho({ ...rascunho, ajuda: e.currentTarget.value })}
                    maxLength={300}
                    placeholder="Explicação curta abaixo da pergunta"
                  />
                </div>
              </div>
              <div class="fe-rascunho-acoes">
                <button type="button" class="btn btn-outline btn-md" onClick={() => setRascunho(null)}>Cancelar</button>
                <button type="button" class="btn btn-primary btn-md" onClick={confirmarRascunho}>
                  {rascunho.id ? 'Atualizar pergunta' : 'Incluir pergunta'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" class="fe-adicionar" onClick={() => abrirRascunho(s.chave)} disabled={Boolean(rascunho)}>
              <Icon name="add_circle" size={18} /> Adicionar pergunta
            </button>
          )}
        </section>
      ))}

      <div class="fe-barra">
        <span class="fe-estado">{alterado ? 'Alterações não salvas' : 'Tudo salvo'}</span>
        <div class="fe-barra-acoes">
          <a class="btn btn-outline btn-md" href={`/formularios/${formulario.id}/respostas`}>Respostas</a>
          <button type="button" class="btn btn-outline btn-md" onClick={duplicar} disabled={salvando}>Duplicar</button>
          <button type="button" class="btn btn-outline btn-md" onClick={excluir} disabled={salvando}>Excluir</button>
          <button type="submit" class="btn btn-success btn-md" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </form>
  );
}

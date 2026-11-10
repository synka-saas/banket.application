// Painel lateral para editar as opções de uma pergunta padrão (ex.: faixas de budget): o grupo "Opções" em cima,
// cada uma com o X para remover, e o campo para incluir novas embaixo (a nova vai para o fim do grupo).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../ui/Icon';
import { confirmar, toast } from '../../lib/ui';

interface Props {
  /** Texto da pergunta, mostrado no topo do painel */
  pergunta: string;
  opcoes: string[];
  ajuda?: string;
  onAplicar: (opcoes: string[]) => void;
  onFechar: () => void;
}

const MAX_OPCAO = 120;

export default function OpcoesDrawer({ pergunta, opcoes: iniciais, ajuda, onAplicar, onFechar }: Props) {
  const [opcoes, setOpcoes] = useState<string[]>(iniciais);
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState('');
  const novaRef = useRef<HTMLInputElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);

  const alterado = nova.trim() !== '' || opcoes.join('\n') !== iniciais.join('\n');

  async function fechar() {
    if (alterado) {
      const sim = await confirmar({
        titulo: 'Descartar as alterações?',
        texto: 'As opções alteradas neste painel ainda não foram aplicadas.',
        confirmar: 'Descartar',
        cancelar: 'Continuar editando',
        perigo: true,
      });
      if (!sim) return;
    }
    onFechar();
  }

  // Esc fecha (com o modal de confirmação aberto, fecha só o modal); o foco volta a quem abriu
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  useEffect(() => {
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    novaRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      fecharRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      focoAnterior.current?.focus({ preventScroll: true });
    };
  }, []);

  function adicionar() {
    const texto = nova.trim();
    if (!texto) return setErro('Digite a opção.');
    if (texto.length > MAX_OPCAO) return setErro(`Cada opção pode ter no máximo ${MAX_OPCAO} caracteres.`);
    if (opcoes.some((o) => o.toLowerCase() === texto.toLowerCase())) return setErro('Esta opção já está na lista.');
    setOpcoes([...opcoes, texto]);
    setNova('');
    setErro('');
    novaRef.current?.focus();
  }

  function remover(idx: number) {
    setOpcoes(opcoes.filter((_, i) => i !== idx));
    novaRef.current?.focus();
  }

  function aplicar() {
    if (nova.trim()) return setErro('Clique em Adicionar para incluir a opção digitada, ou apague o campo.');
    if (opcoes.length < 2) return toast('Informe ao menos 2 opções.', 'error');
    onAplicar(opcoes);
  }

  return (
    <div class="fe-drawer-fundo" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <aside class="fe-drawer" role="dialog" aria-modal="true" aria-labelledby="fe-opcoes-titulo">
        <header class="fe-drawer-header">
          <h2 id="fe-opcoes-titulo" class="fe-drawer-titulo">Editar opções</h2>
          <div class="fe-drawer-acoes">
            <button type="button" class="btn btn-primary btn-sm" onClick={aplicar}>Aplicar opções</button>
            <button type="button" class="fe-drawer-fechar" onClick={fechar} aria-label="Fechar"><Icon name="x" size={18} /></button>
          </div>
        </header>

        <div class="fe-drawer-corpo">
          <p class="fe-opcoes-pergunta">{pergunta}</p>
          {ajuda && <p class="fe-opcoes-ajuda">{ajuda}</p>}

          <section class="fe-opcoes-grupo" aria-labelledby="fe-opcoes-lista">
            <header class="fe-opcoes-grupo-header">
              <span id="fe-opcoes-lista" class="eyebrow">Opções</span>
              <span class="fe-opcoes-contagem tabular">{String(opcoes.length).padStart(2, '0')}</span>
            </header>
            {opcoes.length > 0 ? (
              <ul class="fe-opcoes-lista">
                {opcoes.map((o, i) => (
                  <li class="fe-opcao" key={o}>
                    <span class="fe-opcao-texto">{o}</span>
                    <button type="button" class="fe-opcao-remover" onClick={() => remover(i)} aria-label={`Remover a opção ${o}`} title="Remover">
                      <Icon name="x" size={16} stroke={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p class="fe-opcoes-vazio">Nenhuma opção. Adicione ao menos 2 abaixo.</p>
            )}
          </section>

          <section class="fe-opcoes-nova field">
            <label for="fe-opcao-nova">Adicionar opção</label>
            <div class="fe-opcoes-nova-linha">
              <input
                id="fe-opcao-nova"
                ref={novaRef}
                value={nova}
                maxLength={MAX_OPCAO}
                placeholder="Ex.: De R$ 25.000 a R$ 50.000"
                aria-invalid={erro ? 'true' : undefined}
                onInput={(e) => {
                  setNova(e.currentTarget.value);
                  if (erro) setErro('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    adicionar();
                  }
                }}
              />
              <button type="button" class="btn btn-secondary btn-md" onClick={adicionar}>
                <Icon name="plus" size={16} stroke={1.75} class="btn-icon" /> Adicionar
              </button>
            </div>
            {erro ? <span class="field-erro" role="alert">{erro}</span> : <span class="field-hint">Enter também adiciona. A nova opção entra no fim da lista.</span>}
          </section>
        </div>
      </aside>
    </div>
  );
}

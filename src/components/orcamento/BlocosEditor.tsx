// Editor das abas "Informações complementares" e "Condições gerais": blocos com linhas rótulo/valor.
// Linhas automáticas (restrições, equipe) acompanham o orçamento até serem editadas à mão.
import { useEffect, useRef, useState } from 'preact/hooks';
import { calcularOrcamento, novaChave, type BlocoInfo, type ConteudoOrcamento, type FaixaLocacaoRef } from '../../lib/calculo/orcamento';
import { Acordeao } from './controles';
import { Icon } from '../ui/Icon';
import { confirmar, toast } from '../../lib/ui';
import '../../styles/orcamento.css';

interface Props {
  eventoId: string;
  numero: number;
  congelada: boolean;
  campo: 'informacoes_complementares' | 'condicoes_gerais';
  conteudo: ConteudoOrcamento;
  faixas: FaixaLocacaoRef[];
}

export default function BlocosEditor({ eventoId, numero, congelada, campo, conteudo: inicial, faixas }: Props) {
  const [conteudo, setConteudo] = useState(() => calcularOrcamento(inicial, faixas));
  const [estado, setEstado] = useState<'salvo' | 'pendente' | 'salvando' | 'erro'>('salvo');
  const timer = useRef<number | null>(null);
  const blocos = conteudo[campo];

  function salvar(novos: BlocoInfo[]) {
    if (timer.current) clearTimeout(timer.current);
    setEstado('pendente');
    timer.current = window.setTimeout(async () => {
      setEstado('salvando');
      try {
        const res = await fetch(`/api/orcamentos/${eventoId}/versoes/${numero}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [campo]: novos }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar');
        setEstado('salvo');
      } catch (err) {
        setEstado('erro');
        toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error');
      }
    }, 700);
  }

  function alterar(novos: BlocoInfo[]) {
    if (congelada) return;
    setConteudo(calcularOrcamento({ ...conteudo, [campo]: novos }, faixas));
    salvar(novos);
  }

  // Fechar a aba logo após digitar não perde a última edição (UX-126)
  const ultimoRef = useRef(blocos);
  ultimoRef.current = blocos;
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  useEffect(() => {
    const despachar = () => {
      if (congelada) return;
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (estadoRef.current === 'salvo') return;
      void fetch(`/api/orcamentos/${eventoId}/versoes/${numero}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: ultimoRef.current }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', despachar);
    return () => window.removeEventListener('pagehide', despachar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atualizarBloco = (key: string, patch: Partial<BlocoInfo>) =>
    alterar(blocos.map((b) => (b.key === key ? { ...b, ...patch } : b)));

  // Remover linha sem modal, com Desfazer (volta à mesma posição do bloco atual)
  const blocosAtual = useRef(blocos);
  blocosAtual.current = blocos;
  function removerLinha(bloco: BlocoInfo, linha: BlocoInfo['linhas'][number]) {
    const posicao = bloco.linhas.findIndex((l) => l.key === linha.key);
    atualizarBloco(bloco.key, { linhas: bloco.linhas.filter((x) => x.key !== linha.key) });
    toast(`"${linha.label || 'Linha'}" removido.`, 'info', {
      acao: {
        rotulo: 'Desfazer',
        executar: () => {
          const b = blocosAtual.current.find((x) => x.key === bloco.key);
          if (!b || b.linhas.some((l) => l.key === linha.key)) return;
          const linhas = [...b.linhas];
          linhas.splice(Math.min(Math.max(posicao, 0), linhas.length), 0, linha);
          alterar(blocosAtual.current.map((x) => (x.key === bloco.key ? { ...x, linhas } : x)));
        },
      },
    });
  }

  // Linha nova nasce vazia e o cursor já vai para o rótulo dela
  const [focar, setFocar] = useState<string | null>(null);
  useEffect(() => {
    if (!focar) return;
    document.querySelector<HTMLInputElement>(`[data-linha="${focar}"] input`)?.focus();
    setFocar(null);
  }, [focar]);
  function adicionarLinha(b: BlocoInfo) {
    const key = novaChave('l');
    atualizarBloco(b.key, { linhas: [...b.linhas, { key, label: '', valor: '', auto: null }] });
    setFocar(key);
  }

  // Setas movem a linha dentro do bloco (UX-130)
  function moverLinha(b: BlocoInfo, key: string, passo: -1 | 1) {
    const i = b.linhas.findIndex((l) => l.key === key);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= b.linhas.length) return;
    const linhas = [...b.linhas];
    [linhas[i], linhas[j]] = [linhas[j], linhas[i]];
    atualizarBloco(b.key, { linhas });
  }

  const atualizarLinha = (bloco: BlocoInfo, linhaKey: string, patch: { label?: string; valor?: string }) =>
    atualizarBloco(bloco.key, {
      // Editar uma linha automática a torna manual
      linhas: bloco.linhas.map((l) => (l.key === linhaKey ? { ...l, ...patch, auto: null } : l)),
    });

  return (
    <div class="blocos-editor">
      {!congelada && (
        <p class={`orc-estado estado-${estado}`} role="status">
          {{ salvo: 'Todas as alterações salvas', pendente: 'Alterações pendentes…', salvando: 'Salvando…', erro: 'Erro ao salvar' }[estado]}
        </p>
      )}

      {blocos.map((b) => (
        <Acordeao key={b.key} titulo={b.titulo} icone="info">
          {!congelada && (
            <div class="adicionar-linha">
              <input class="control" value={b.titulo} aria-label="Título do bloco" maxLength={200}
                onBlur={(e) => e.currentTarget.value.trim() && e.currentTarget.value !== b.titulo && atualizarBloco(b.key, { titulo: e.currentTarget.value.trim() })} />
              <button type="button" class="link-perigo" onClick={async () => (await confirmar({ titulo: `Remover o bloco "${b.titulo}"?`, confirmar: 'Remover', perigo: true })) && alterar(blocos.filter((x) => x.key !== b.key))}>
                Remover bloco
              </button>
            </div>
          )}

          {b.auto === 'staff' && (
            <p class="vazio">
              Preenchido automaticamente a partir do staff do orçamento.{' '}
              {!congelada && (
                <button type="button" class="ed-link-inline" onClick={() => atualizarBloco(b.key, { auto: null })}>Editar manualmente</button>
              )}
            </p>
          )}

          {b.linhas.length === 0 ? (
            <p class="vazio">Nenhuma linha.</p>
          ) : (
            <div class="bloco-kv-linhas">
              {b.linhas.map((l) => (
                <div class="bloco-kv-linha" key={l.key} data-linha={l.key}>
                  <input value={l.label} disabled={congelada || b.auto === 'staff'} aria-label="Rótulo" maxLength={200} placeholder="Rótulo (ex.: Estacionamento)"
                    onBlur={(e) => e.currentTarget.value !== l.label && atualizarLinha(b, l.key, { label: e.currentTarget.value })} />
                  {l.valor.length > 60 ? (
                    <textarea class="valor-kv" rows={2} value={l.valor} disabled={congelada || b.auto === 'staff'} aria-label={`Valor de ${l.label}`} maxLength={2000}
                      onBlur={(e) => e.currentTarget.value !== l.valor && atualizarLinha(b, l.key, { valor: e.currentTarget.value })} />
                  ) : (
                    <input class="valor-kv" value={l.valor} disabled={congelada || b.auto === 'staff'} aria-label={`Valor de ${l.label}`} maxLength={2000}
                      onBlur={(e) => e.currentTarget.value !== l.valor && atualizarLinha(b, l.key, { valor: e.currentTarget.value })} />
                  )}
                  <span class="linha-acoes">
                    {l.auto && <span class="auto-selo" title="Calculado a partir do orçamento">auto</span>}
                    {!congelada && b.auto !== 'staff' && (
                      <>
                        <button type="button" class="remover" aria-label={`Mover ${l.label || 'linha'} para cima`} disabled={b.linhas[0]?.key === l.key} onClick={() => moverLinha(b, l.key, -1)}><Icon name="keyboard_arrow_up" size={18} /></button>
                        <button type="button" class="remover" aria-label={`Mover ${l.label || 'linha'} para baixo`} disabled={b.linhas[b.linhas.length - 1]?.key === l.key} onClick={() => moverLinha(b, l.key, 1)}><Icon name="keyboard_arrow_down" size={18} /></button>
                        <button type="button" class="remover" aria-label={`Remover ${l.label || 'linha'}`} onClick={() => removerLinha(b, l)}><Icon name="close" size={18} /></button>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!congelada && b.auto !== 'staff' && (
            <button type="button" class="btn btn-outline btn-sm" onClick={() => adicionarLinha(b)}>
              <Icon name="add_circle" size={18} /> Adicionar linha
            </button>
          )}
        </Acordeao>
      ))}

      {!congelada && (
        <button type="button" class="btn btn-primary btn-md" onClick={() => alterar([...blocos, { key: novaChave('b'), titulo: 'Novo bloco', auto: null, linhas: [] }])}>
          <Icon name="add_circle" size={18} /> Adicionar bloco
        </button>
      )}
    </div>
  );
}

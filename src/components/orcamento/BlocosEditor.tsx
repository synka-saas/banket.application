// Editor das abas "Informações complementares" e "Condições gerais": blocos com linhas rótulo/valor.
// Linhas automáticas (restrições, equipe) acompanham o orçamento até serem editadas à mão.
import { useRef, useState } from 'preact/hooks';
import { calcularOrcamento, novaChave, type BlocoInfo, type ConteudoOrcamento, type FaixaLocacaoRef } from '../../lib/calculo/orcamento';
import { Acordeao } from './controles';
import { Icon } from '../ui/Icon';
import '../../styles/orcamento.css';

interface Props {
  eventoId: string;
  numero: number;
  congelada: boolean;
  campo: 'informacoes_complementares' | 'condicoes_gerais';
  conteudo: ConteudoOrcamento;
  faixas: FaixaLocacaoRef[];
}

function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  (window as unknown as { banketToast?: (m: string, t: string) => void }).banketToast?.(message, type);
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

  const atualizarBloco = (key: string, patch: Partial<BlocoInfo>) =>
    alterar(blocos.map((b) => (b.key === key ? { ...b, ...patch } : b)));

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
        <Acordeao key={b.key} titulo={b.titulo}>
          {!congelada && (
            <div class="adicionar-linha">
              <input class="control" value={b.titulo} aria-label="Título do bloco" maxLength={200}
                onBlur={(e) => e.currentTarget.value.trim() && e.currentTarget.value !== b.titulo && atualizarBloco(b.key, { titulo: e.currentTarget.value.trim() })} />
              <button type="button" class="link-perigo" onClick={() => window.confirm(`Remover o bloco "${b.titulo}"?`) && alterar(blocos.filter((x) => x.key !== b.key))}>
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
                <div class="bloco-kv-linha" key={l.key}>
                  <input value={l.label} disabled={congelada || b.auto === 'staff'} aria-label="Rótulo" maxLength={200}
                    onBlur={(e) => e.currentTarget.value !== l.label && atualizarLinha(b, l.key, { label: e.currentTarget.value })} />
                  {l.valor.length > 60 ? (
                    <textarea class="valor-kv" rows={2} value={l.valor} disabled={congelada || b.auto === 'staff'} aria-label={`Valor de ${l.label}`} maxLength={2000}
                      onBlur={(e) => e.currentTarget.value !== l.valor && atualizarLinha(b, l.key, { valor: e.currentTarget.value })} />
                  ) : (
                    <input class="valor-kv" value={l.valor} disabled={congelada || b.auto === 'staff'} aria-label={`Valor de ${l.label}`} maxLength={2000}
                      onBlur={(e) => e.currentTarget.value !== l.valor && atualizarLinha(b, l.key, { valor: e.currentTarget.value })} />
                  )}
                  <span>
                    {l.auto && <span class="auto-selo" title="Calculado a partir do orçamento">auto</span>}
                    {!congelada && b.auto !== 'staff' && (
                      <button type="button" class="remover" aria-label={`Remover ${l.label}`} onClick={() => atualizarBloco(b.key, { linhas: b.linhas.filter((x) => x.key !== l.key) })}><Icon name="close" size={18} /></button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!congelada && b.auto !== 'staff' && (
            <button type="button" class="btn btn-outline btn-sm" onClick={() => atualizarBloco(b.key, { linhas: [...b.linhas, { key: novaChave('l'), label: 'Novo item', valor: '', auto: null }] })}>
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

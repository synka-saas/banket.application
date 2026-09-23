// Textos da proposta: blocos de Templates › Blocos de Informação incluídos nesta versão.
// Cada bloco incluído é uma cópia: editar o texto aqui não altera o cadastro, e vice-versa.
import { useRef, useState } from 'preact/hooks';
import { novaChave, type BlocoTexto } from '../../lib/calculo/orcamento';
import { Acordeao } from './controles';
import '../../styles/orcamento.css';

interface BlocoCadastro {
  id: string;
  titulo: string;
  texto: string;
  pagina: BlocoTexto['pagina'];
}

interface Props {
  eventoId: string;
  numero: number;
  congelada: boolean;
  textos: BlocoTexto[];
  cadastro: BlocoCadastro[];
  paginas: Record<BlocoTexto['pagina'], string>;
}

function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  (window as unknown as { banketToast?: (m: string, t: string) => void }).banketToast?.(message, type);
}

export default function TextosProposta({ eventoId, numero, congelada, textos: inicial, cadastro, paginas }: Props) {
  const [textos, setTextos] = useState(inicial);
  const [estado, setEstado] = useState<'salvo' | 'pendente' | 'salvando' | 'erro'>('salvo');
  const timer = useRef<number | null>(null);

  function alterar(novos: BlocoTexto[]) {
    if (congelada) return;
    setTextos(novos);
    setEstado('pendente');
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setEstado('salvando');
      try {
        const res = await fetch(`/api/orcamentos/${eventoId}/versoes/${numero}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocos_texto: novos }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar');
        setEstado('salvo');
      } catch (err) {
        setEstado('erro');
        toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error');
      }
    }, 500);
  }

  const incluido = (id: string) => textos.find((t) => t.bloco_id === id);

  function alternar(b: BlocoCadastro) {
    const atual = incluido(b.id);
    if (atual) alterar(textos.filter((t) => t.key !== atual.key));
    else alterar([...textos, { key: novaChave('t'), bloco_id: b.id, titulo: b.titulo, texto: b.texto, pagina: b.pagina }]);
  }

  const ordemPaginas = Object.keys(paginas) as BlocoTexto['pagina'][];
  // Textos incluídos cujo bloco foi excluído do cadastro continuam na versão
  const avulsos = textos.filter((t) => !t.bloco_id || !cadastro.some((b) => b.id === t.bloco_id));

  return (
    <Acordeao titulo="Textos da proposta" resumo={`${textos.length} incluído${textos.length === 1 ? '' : 's'}`}>
      <div class="textos-proposta">
        <p class="muted">
          Blocos de texto impressos no PDF, na página indicada. Marque para incluir nesta versão; o texto pode ser ajustado só para este orçamento.
        </p>
        {!congelada && (
          <p class={`orc-estado estado-${estado}`} role="status">
            {{ salvo: 'Todas as alterações salvas', pendente: 'Alterações pendentes…', salvando: 'Salvando…', erro: 'Erro ao salvar' }[estado]}
          </p>
        )}
        {ordemPaginas.map((pagina) => {
          const doCadastro = cadastro.filter((b) => b.pagina === pagina);
          const extras = avulsos.filter((t) => t.pagina === pagina);
          if (!doCadastro.length && !extras.length) return null;
          return (
            <div class="textos-grupo" key={pagina}>
              <span class="grupo-titulo">{paginas[pagina]}</span>
              {doCadastro.map((b) => {
                const t = incluido(b.id);
                return (
                  <div class="texto-item" key={b.id}>
                    <label class="switch">
                      <input type="checkbox" checked={!!t} disabled={congelada} onChange={() => alternar(b)} />
                      {b.titulo}
                    </label>
                    {t && (
                      <textarea class="control" rows={4} maxLength={10000} disabled={congelada} value={t.texto} aria-label={`Texto de ${b.titulo}`}
                        onBlur={(e) => e.currentTarget.value !== t.texto && alterar(textos.map((x) => (x.key === t.key ? { ...x, texto: e.currentTarget.value } : x)))} />
                    )}
                  </div>
                );
              })}
              {extras.map((t) => (
                <div class="texto-item" key={t.key}>
                  <label class="switch">
                    <input type="checkbox" checked disabled={congelada} onChange={() => alterar(textos.filter((x) => x.key !== t.key))} />
                    {t.titulo} <span class="muted">(removido do cadastro)</span>
                  </label>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </Acordeao>
  );
}

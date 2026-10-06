// Barra de formatação do editor de documentos (navegador): aplica a marcação simples de lib/texto.ts na seleção
// do textarea, para quem não conhece os marcadores. Função pura sobre o textarea; dispara "input" ao final.

export type FormatoTexto = 'negrito' | 'italico' | 'titulo' | 'subtitulo' | 'lista' | 'numerada' | 'centro' | 'quebra';

const PREFIXOS: Partial<Record<FormatoTexto, string>> = {
  titulo: '# ',
  subtitulo: '## ',
  lista: '- ',
  numerada: '1. ',
  centro: '>> ',
};

function envolver(area: HTMLTextAreaElement, marca: string) {
  const { selectionStart: ini, selectionEnd: fim, value } = area;
  const trecho = value.slice(ini, fim) || 'texto';
  const ja = value.slice(ini - marca.length, ini) === marca && value.slice(fim, fim + marca.length) === marca;
  if (ja) {
    area.value = value.slice(0, ini - marca.length) + trecho + value.slice(fim + marca.length);
    area.setSelectionRange(ini - marca.length, fim - marca.length);
  } else {
    area.value = value.slice(0, ini) + marca + trecho + marca + value.slice(fim);
    area.setSelectionRange(ini + marca.length, ini + marca.length + trecho.length);
  }
}

/** Aplica (ou remove) o prefixo em todas as linhas da seleção. */
function prefixar(area: HTMLTextAreaElement, prefixo: string) {
  const { value } = area;
  const ini = value.lastIndexOf('\n', area.selectionStart - 1) + 1;
  const fimLinha = value.indexOf('\n', area.selectionEnd);
  const fim = fimLinha === -1 ? value.length : fimLinha;
  const linhas = value.slice(ini, fim).split('\n');
  const todasTem = linhas.every((l) => l.startsWith(prefixo) || !l.trim());
  const limpar = (l: string) => l.replace(/^(#{1,2} |[-•] |\d+[.)] |>> )/, '');
  let n = 0;
  const novas = linhas.map((l) => {
    if (!l.trim()) return l;
    const base = limpar(l);
    if (todasTem) return base;
    n += 1;
    return (prefixo === '1. ' ? `${n}. ` : prefixo) + base;
  });
  const bloco = novas.join('\n');
  area.value = value.slice(0, ini) + bloco + value.slice(fim);
  area.setSelectionRange(ini, ini + bloco.length);
}

export function aplicarFormato(area: HTMLTextAreaElement, formato: FormatoTexto) {
  if (formato === 'negrito') envolver(area, '**');
  else if (formato === 'italico') envolver(area, '_');
  else if (formato === 'quebra') inserirTexto(area, '\n---\n');
  else prefixar(area, PREFIXOS[formato]!);
  area.focus();
  area.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Insere texto na posição do cursor (ex.: uma {variavel}). */
export function inserirTexto(area: HTMLTextAreaElement, texto: string) {
  const { selectionStart: ini, selectionEnd: fim, value } = area;
  area.value = value.slice(0, ini) + texto + value.slice(fim);
  const pos = ini + texto.length;
  area.setSelectionRange(pos, pos);
  area.focus();
  area.dispatchEvent(new Event('input', { bubbles: true }));
}

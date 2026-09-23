// Marcação simples dos blocos de texto da proposta → HTML seguro.
//   "## Subtítulo"            → <h4>
//   "- item" / "• item"       → <ul><li>
//   "**negrito**"             → <strong>
//   linhas em sequência       → um parágrafo; linha em branco separa parágrafos
import { escapeHtml } from './html';

function inline(texto: string): string {
  return escapeHtml(texto).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export function renderTexto(markup: string | null | undefined): string {
  if (!markup) return '';
  const saida: string[] = [];
  let lista: string[] = [];
  let paragrafo: string[] = [];

  const fecharLista = () => {
    if (lista.length) saida.push(`<ul>${lista.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`);
    lista = [];
  };
  const fecharParagrafo = () => {
    if (paragrafo.length) saida.push(`<p>${paragrafo.map(inline).join('<br />')}</p>`);
    paragrafo = [];
  };

  for (const bruta of markup.replace(/\r\n?/g, '\n').split('\n')) {
    const linha = bruta.trim();
    const item = linha.match(/^[-•]\s+(.*)$/);
    if (!linha) {
      fecharLista();
      fecharParagrafo();
    } else if (linha.startsWith('## ')) {
      fecharLista();
      fecharParagrafo();
      saida.push(`<h4>${inline(linha.slice(3))}</h4>`);
    } else if (item) {
      fecharParagrafo();
      lista.push(item[1]);
    } else {
      fecharLista();
      paragrafo.push(linha);
    }
  }
  fecharLista();
  fecharParagrafo();
  return saida.join('');
}

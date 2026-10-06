// Marcação simples dos textos da proposta e dos documentos → HTML seguro.
//   "# Título"                → <h3>
//   "## Subtítulo"            → <h4>
//   "- item" / "• item"       → <ul><li>
//   "1. item" / "1) item"     → <ol><li>
//   ">> texto"                → parágrafo centralizado
//   "---" (linha sozinha)     → quebra de página (só vale na impressão)
//   "**negrito**"             → <strong>   ·   "_itálico_" → <em>
//   linhas em sequência       → um parágrafo; linha em branco separa parágrafos
// O editor de documentos tem uma barra que aplica esta marcação; os blocos da proposta usam o mesmo renderizador.
import { escapeHtml } from './html';

function inline(texto: string): string {
  return escapeHtml(texto)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])_([^_\n]+?)_(?=[^\w]|$)/g, '$1<em>$2</em>');
}

export function renderTexto(markup: string | null | undefined): string {
  if (!markup) return '';
  const saida: string[] = [];
  let lista: string[] = [];
  let numerada: string[] = [];
  let paragrafo: string[] = [];
  let centro: string[] = [];

  const fecharLista = () => {
    if (lista.length) saida.push(`<ul>${lista.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`);
    lista = [];
  };
  const fecharNumerada = () => {
    if (numerada.length) saida.push(`<ol>${numerada.map((i) => `<li>${inline(i)}</li>`).join('')}</ol>`);
    numerada = [];
  };
  const fecharParagrafo = () => {
    if (paragrafo.length) saida.push(`<p>${paragrafo.map(inline).join('<br />')}</p>`);
    paragrafo = [];
  };
  const fecharCentro = () => {
    if (centro.length) saida.push(`<p class="centro">${centro.map(inline).join('<br />')}</p>`);
    centro = [];
  };
  const fecharTudo = () => {
    fecharLista();
    fecharNumerada();
    fecharParagrafo();
    fecharCentro();
  };

  for (const bruta of markup.replace(/\r\n?/g, '\n').split('\n')) {
    const linha = bruta.trim();
    const item = linha.match(/^[-•]\s+(.*)$/);
    const itemNumerado = linha.match(/^\d+[.)]\s+(.*)$/);
    const centrado = linha.match(/^>>\s?(.*)$/);
    if (!linha) {
      fecharTudo();
    } else if (linha === '---') {
      fecharTudo();
      saida.push('<div class="quebra-pagina"></div>');
    } else if (linha.startsWith('## ')) {
      fecharTudo();
      saida.push(`<h4>${inline(linha.slice(3))}</h4>`);
    } else if (linha.startsWith('# ')) {
      fecharTudo();
      saida.push(`<h3>${inline(linha.slice(2))}</h3>`);
    } else if (item) {
      fecharNumerada();
      fecharParagrafo();
      fecharCentro();
      lista.push(item[1]);
    } else if (itemNumerado) {
      fecharLista();
      fecharParagrafo();
      fecharCentro();
      numerada.push(itemNumerado[1]);
    } else if (centrado) {
      fecharLista();
      fecharNumerada();
      fecharParagrafo();
      centro.push(centrado[1]);
    } else {
      fecharLista();
      fecharNumerada();
      fecharCentro();
      paragrafo.push(linha);
    }
  }
  fecharTudo();
  return saida.join('');
}

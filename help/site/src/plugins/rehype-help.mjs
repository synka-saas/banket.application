// Converte o HTML padrão do Markdown nos blocos do protótipo (Central de Ajuda.dc.html):
//  - parágrafo só com imagem      → figura com moldura e legenda (bloco "shot")
//  - lista numerada               → passos com número em círculo (bloco "steps")
//  - lista com marcador           → lista com ponto azul (bloco "list")
//  - tabela                       → tabela com hairline e cantos de 14px (bloco "defs")
//  - citação "> **Atenção:** …"   → Banner de aviso; outras citações → Banner informativo (bloco "note")
import { visit, SKIP } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';
import { iconSvg } from '../lib/icons.mjs';

const isWhitespace = (n) => n.type === 'text' && !n.value.trim();
const el = (tagName, className, children = [], extra = {}) => ({
  type: 'element',
  tagName,
  properties: { className: [className], ...extra },
  children,
});

const WARNING_RE = /^(aten[çc][ãa]o|importante|cuidado)\b/i;

export default function rehypeHelp() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || index == null) return;

      // Figura
      if (node.tagName === 'p') {
        const meaningful = node.children.filter((c) => !isWhitespace(c));
        if (meaningful.length === 1 && meaningful[0].type === 'element' && meaningful[0].tagName === 'img') {
          const img = meaningful[0];
          // A coluna do artigo tem no máximo 720px (card de 48px de respiro); no celular, a tela menos as margens.
          img.properties.sizes = '(min-width: 900px) 720px, calc(100vw - 72px)';
          const caption = String(img.properties?.alt || '').trim();
          const figure = el('figure', 'kb-shot', [
            el('div', 'kb-shot-frame', [img]),
            ...(caption ? [el('figcaption', 'kb-shot-caption', [{ type: 'text', value: caption }])] : []),
          ]);
          parent.children[index] = figure;
          return SKIP;
        }
      }

      // Tabela
      if (node.tagName === 'table') {
        parent.children[index] = el('div', 'kb-table', [node]);
        return SKIP;
      }

      // Banner
      if (node.tagName === 'blockquote') {
        const text = toString(node).trim();
        const tone = WARNING_RE.test(text) ? 'warning' : 'brand';
        const icon = tone === 'warning' ? 'triangle-alert' : 'info';
        const body = node.children.filter((c) => !isWhitespace(c));
        parent.children[index] = el('div', `kb-banner`, [
          el('span', 'kb-banner-icon', [{ type: 'raw', value: iconSvg(icon, 18) }]),
          el('div', 'kb-banner-body', body),
        ], { dataTone: tone, role: 'note' });
        return SKIP;
      }

      // Listas: o conteúdo de cada item vai num wrapper para o marcador ocupar a coluna da esquerda
      if (node.tagName === 'ol' || node.tagName === 'ul') {
        node.properties = node.properties || {};
        node.properties.className = [node.tagName === 'ol' ? 'kb-steps' : 'kb-list'];
        if (node.tagName === 'ol' && node.properties.start && Number(node.properties.start) !== 1) {
          node.properties.style = `counter-reset: kb-step ${Number(node.properties.start) - 1}`;
        }
        for (const li of node.children) {
          if (li.type !== 'element' || li.tagName !== 'li') continue;
          li.children = [el('div', 'kb-li', li.children)];
        }
      }
    });
  };
}

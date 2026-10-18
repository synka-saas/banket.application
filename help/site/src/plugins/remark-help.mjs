// Ajustes do Markdown de help/support/ antes de virar HTML:
//  - remove o "# Título": a página do artigo exibe o título (e a description do
//    frontmatter como resumo) no cabeçalho do card, como no protótipo;
//  - reescreve links entre artigos (../05-agenda/x.md → /ajuda/agenda/x/);
//  - garante que imagens relativas comecem com ./ (o pipeline de imagens do
//    Astro só otimiza caminhos explicitamente relativos);
//  - falha o build com mensagem clara se um link ou imagem não existir.
import fs from 'node:fs';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import { articleLocation, isArticleLink } from '../lib/paths.mjs';

export default function remarkHelp() {
  return (tree, file) => {
    const filePath = file.path ? path.resolve(file.path) : null;
    if (!filePath) return;
    const dir = path.dirname(filePath);
    const problems = [];

    // Título
    const idx = tree.children.findIndex((n) => n.type === 'heading' && n.depth === 1);
    if (idx !== -1) tree.children.splice(idx, 1);

    visit(tree, (node) => {
      if (node.type === 'link' && isArticleLink(node.url)) {
        const [rel, hash] = node.url.split('#');
        const target = path.resolve(dir, decodeURI(rel));
        if (!fs.existsSync(target)) {
          problems.push(`link quebrado "${node.url}"`);
          return;
        }
        node.url = articleLocation(target).url + (hash ? `#${hash}` : '');
      }
      if (node.type === 'image' && node.url && !/^([a-z]+:|\/)/i.test(node.url)) {
        if (!node.url.startsWith('.')) node.url = `./${node.url}`;
        if (!fs.existsSync(path.resolve(dir, decodeURI(node.url)))) {
          problems.push(`imagem inexistente "${node.url}"`);
        }
      }
    });

    if (problems.length) {
      throw new Error(`[central de ajuda] ${path.relative(process.cwd(), filePath)}:\n  - ${problems.join('\n  - ')}`);
    }
  };
}

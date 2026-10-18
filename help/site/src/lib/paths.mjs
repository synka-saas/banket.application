// Regras de caminho e slug compartilhadas entre o build (plugins remark/rehype,
// páginas) e o validador de conteúdo (scripts/check-content.mjs).
//
// O conteúdo vive em help/support/ (fonte única da verdade):
//   NN-categoria/                 pasta da categoria (o prefixo numérico dá a ordem)
//     nome-do-artigo/             pasta do artigo: o nome dela vira a URL
//       nome-do-artigo.md         o texto (qualquer nome .md; um por pasta)
//       nome-do-artigo-01.webp    as imagens do artigo
// Também aceita o formato plano antigo (NN-categoria/nome-do-artigo.md).
// URL: /ajuda/<categoria-sem-prefixo>/<artigo>/
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export const BASE = '/ajuda';

// help/site → help/support. SUPPORT_DIR permite apontar para outro lugar (ex.: testes).
export const SUPPORT_DIR = path.resolve(process.env.SUPPORT_DIR || path.join(process.cwd(), '..', 'support'));

// Minúsculas, sem acento, só [a-z0-9-].
export function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// "05-agenda" → { order: 5, slug: "agenda" }
export function parseFolder(folder) {
  const m = /^(\d+)[-_ ]?(.*)$/.exec(folder);
  return m ? { order: Number(m[1]), slug: slugify(m[2] || folder) } : { order: 999, slug: slugify(folder) };
}

// Frontmatter mínimo, só para os campos que mudam a URL (categoria).
const fmCache = new Map();
export function readFrontmatter(absFile) {
  if (fmCache.has(absFile)) return fmCache.get(absFile);
  let data = {};
  try {
    const raw = fs.readFileSync(absFile, 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (m) data = yaml.load(m[1]) || {};
  } catch { /* arquivo inexistente: quem chama trata */ }
  fmCache.set(absFile, data);
  return data;
}

// Arquivo .md absoluto → { categorySlug, articleSlug, url }
export function articleLocation(absFile) {
  const parts = path.relative(SUPPORT_DIR, absFile).split(path.sep);
  const folder = parts[0];
  const fm = readFrontmatter(absFile);
  const categorySlug = fm.category ? slugify(fm.category) : parseFolder(folder).slug;
  // Pasta por artigo → nome da pasta; formato plano → nome do arquivo.
  const articleSlug = slugify(parts.length >= 3 ? parts[1] : path.basename(absFile, path.extname(absFile)));
  return { categorySlug, articleSlug, url: `${BASE}/${categorySlug}/${articleSlug}/` };
}

// O link aponta para um artigo da central? (relativo, termina em .md)
export function isArticleLink(url) {
  return !!url && !/^[a-z]+:/i.test(url) && !url.startsWith('/') && !url.startsWith('#') && /\.md(#.*)?$/i.test(url);
}

// Artigo = .md dentro de uma pasta de categoria (plano) ou de uma pasta de artigo.
// Arquivos na raiz de support/ (README.md, IMAGENS.md) e pastas "_" ou "." ficam de fora.
export function isArticleFile(relPath) {
  const parts = relPath.split(/[\\/]/);
  if (parts.length < 2 || parts.length > 3 || !/\.md$/i.test(parts[parts.length - 1])) return false;
  return parts.slice(0, -1).every((p) => !p.startsWith('_') && !p.startsWith('.'));
}

// Lista recursiva (até a pasta do artigo) de todos os arquivos de support/, relativa.
export function listSupportFiles() {
  const out = [];
  const walk = (dir, depth) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory() && depth < 2) walk(abs, depth + 1);
      else if (e.isFile()) out.push(path.relative(SUPPORT_DIR, abs));
    }
  };
  walk(SUPPORT_DIR, 0);
  return out;
}

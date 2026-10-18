#!/usr/bin/env node
// Valida help/support/ antes do build (roda sozinho com `npm run check:content`).
//
// Erros (falham o build):  link para artigo inexistente, imagem inexistente,
//                          artigo sem título (# H1 ou frontmatter title),
//                          duas URLs iguais, ícone de categoria inexistente.
// Avisos (não falham):     imagem que nenhum artigo usa, link externo http://,
//                          imagem sem texto alternativo.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { SUPPORT_DIR, articleLocation, isArticleFile, isArticleLink, listSupportFiles, readFrontmatter } from '../src/lib/paths.mjs';

const errors = [];
const warnings = [];
const rel = (p) => path.relative(SUPPORT_DIR, p);

if (!fs.existsSync(SUPPORT_DIR)) {
  console.error(`✗ Pasta de conteúdo não encontrada: ${SUPPORT_DIR}`);
  process.exit(1);
}

const files = listSupportFiles();
const articles = files.filter(isArticleFile).map((f) => path.join(SUPPORT_DIR, f));
const images = new Set(files.filter((f) => f.includes(path.sep) && /\.(webp|png|jpe?g|gif|svg|avif)$/i.test(f)).map((f) => path.join(SUPPORT_DIR, f)));
const usedImages = new Set();
const urls = new Map();

// Ignora trechos de código ao procurar links e imagens.
const stripCode = (s) => s.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');

// Uma pasta de artigo deve ter um único .md.
const perFolder = new Map();
for (const f of articles) if (path.relative(SUPPORT_DIR, f).split(path.sep).length === 3) {
  const d = path.dirname(f);
  perFolder.set(d, (perFolder.get(d) || 0) + 1);
}
for (const [d, n] of perFolder) if (n > 1) errors.push(`${rel(d)}/: ${n} arquivos .md na mesma pasta de artigo (use um só)`);

for (const file of articles) {
  const raw = fs.readFileSync(file, 'utf8');
  const body = stripCode(raw.replace(/^---\r?\n[\s\S]*?\r?\n---/, ''));
  const fm = readFrontmatter(file);
  const dir = path.dirname(file);

  if (!fm.title && !/^#\s+\S/m.test(body)) errors.push(`${rel(file)}: sem título (# H1 ou "title" no frontmatter)`);

  const { url } = articleLocation(file);
  if (urls.has(url)) errors.push(`${rel(file)}: URL ${url} repetida (também em ${rel(urls.get(url))})`);
  urls.set(url, file);

  for (const m of body.matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    const [, alt, src] = m;
    if (/^[a-z]+:/i.test(src)) { warnings.push(`${rel(file)}: imagem externa ${src}`); continue; }
    const target = path.resolve(dir, decodeURI(src));
    if (!fs.existsSync(target)) errors.push(`${rel(file)}: imagem inexistente "${src}"`);
    else usedImages.add(target);
    if (!alt.trim()) warnings.push(`${rel(file)}: imagem "${src}" sem texto alternativo (vira a legenda)`);
  }

  for (const m of body.matchAll(/(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    const href = m[1];
    if (/^http:\/\//i.test(href)) warnings.push(`${rel(file)}: link sem HTTPS ${href}`);
    if (!isArticleLink(href)) continue;
    const target = path.resolve(dir, decodeURI(href.split('#')[0]));
    if (!fs.existsSync(target)) errors.push(`${rel(file)}: link quebrado "${href}"`);
  }
}

for (const img of images) if (!usedImages.has(img)) warnings.push(`${rel(img)}: imagem não usada por nenhum artigo`);

// Ícones das categorias
const catFile = path.join(SUPPORT_DIR, '_categorias.yml');
if (fs.existsSync(catFile)) {
  const iconsDir = path.join(process.cwd(), 'node_modules', '@tabler', 'icons', 'icons', 'outline');
  const meta = yaml.load(fs.readFileSync(catFile, 'utf8')) || {};
  for (const [folder, m] of Object.entries(meta)) {
    if (!fs.existsSync(path.join(SUPPORT_DIR, folder))) warnings.push(`_categorias.yml: pasta "${folder}" não existe`);
    if (m?.icone && fs.existsSync(iconsDir) && !fs.existsSync(path.join(iconsDir, `${m.icone}.svg`))) {
      errors.push(`_categorias.yml: ícone "${m.icone}" (${folder}) não existe no Tabler (outline)`);
    }
  }
}

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✗ ${e}`);
console.log(`\nConteúdo: ${articles.length} artigos, ${images.size} imagens (${usedImages.size} em uso). ${errors.length} erro(s), ${warnings.length} aviso(s).`);
process.exit(errors.length ? 1 : 0);

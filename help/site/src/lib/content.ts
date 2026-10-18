// Monta categorias e artigos a partir da coleção + help/support/_categorias.yml (ícone e descrição da categoria).
// Título da categoria: "titulo" do _categorias.yml, senão o "category" do frontmatter dos artigos da pasta.
// Tudo que não vem no frontmatter é derivado aqui (ver src/content.config.ts).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { getCollection, type CollectionEntry } from 'astro:content';
import { BASE, SUPPORT_DIR, articleLocation, parseFolder, slugify } from './paths.mjs';

export type Entry = CollectionEntry<'artigos'>;

export interface Article {
  id: string;
  slug: string;
  categorySlug: string;
  url: string;
  title: string;
  description: string;
  minutes: number;
  updatedAt: Date;
  entry: Entry;
}

export interface Category {
  slug: string;
  title: string;
  description: string;
  icon: string;
  order: number;
  url: string;
  articles: Article[];
}

interface CategoryMeta {
  titulo?: string;
  descricao?: string;
  icone?: string;
  artigos?: string[];
}

function loadCategoryMeta(): Record<string, CategoryMeta> {
  const file = path.join(SUPPORT_DIR, '_categorias.yml');
  if (!fs.existsSync(file)) return {};
  return (yaml.load(fs.readFileSync(file, 'utf8')) as Record<string, CategoryMeta>) || {};
}

// Markdown inline → texto (para resumo e contagem de palavras).
export function plainText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// "# Título" e o primeiro parágrafo depois dele.
function titleAndIntro(body: string): { title: string; intro: string } {
  const lines = body.split(/\r?\n/);
  const h1 = lines.findIndex((l) => /^#\s+/.test(l));
  const title = h1 >= 0 ? lines[h1].replace(/^#\s+/, '').trim() : '';
  let i = h1 + 1;
  while (i < lines.length && !lines[i].trim()) i++;
  const para: string[] = [];
  while (i < lines.length && lines[i].trim() && !/^(#|\||>|!\[|\s*[-*]\s|\d+\.\s)/.test(lines[i])) para.push(lines[i++]);
  return { title, intro: plainText(para.join(' ')) };
}

const folderOf = (abs: string) => path.relative(SUPPORT_DIR, abs).split(path.sep)[0];

const titleFromSlug = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');

let cached: Promise<Category[]> | null = null;

export function getCategories(): Promise<Category[]> {
  cached ??= build();
  return cached;
}

async function build(): Promise<Category[]> {
  const meta = loadCategoryMeta();
  const entries = await getCollection('artigos');
  const byCategory = new Map<string, Category>();
  const orderOf = new Map<string, number>();

  // Categorias declaradas por pasta (mesmo vazias, para manter a ordem do arquivo).
  for (const folder of fs.readdirSync(SUPPORT_DIR, { withFileTypes: true })) {
    if (!folder.isDirectory() || /^[_.]/.test(folder.name)) continue;
    const { order, slug } = parseFolder(folder.name);
    const m = meta[folder.name] || {};
    byCategory.set(slug, {
      slug,
      title: m.titulo || titleFromSlug(slug),
      description: m.descricao || '',
      icon: m.icone || 'folder',
      order,
      url: `${BASE}/${slug}/`,
      articles: [],
    });
    (m.artigos || []).forEach((a, i) => orderOf.set(`${slug}/${slugify(a)}`, i + 1));
  }

  for (const entry of entries) {
    const abs = path.resolve(process.cwd(), entry.filePath!);
    const loc = articleLocation(abs);
    const { title, intro } = titleAndIntro(entry.body || '');
    const words = plainText(entry.body || '').split(' ').filter(Boolean).length;

    let cat = byCategory.get(loc.categorySlug);
    if (!cat) {
      // Categoria vinda só do frontmatter (sem pasta correspondente).
      cat = { slug: loc.categorySlug, title: titleFromSlug(loc.categorySlug), description: '', icon: 'folder', order: 900, url: `${BASE}/${loc.categorySlug}/`, articles: [] };
      byCategory.set(cat.slug, cat);
    }

    if (!meta[folderOf(abs)]?.titulo && entry.data.category && cat.title === titleFromSlug(cat.slug)) cat.title = entry.data.category;

    cat.articles.push({
      id: entry.id,
      slug: loc.articleSlug,
      categorySlug: cat.slug,
      url: loc.url,
      title: entry.data.title || title || titleFromSlug(loc.articleSlug),
      description: entry.data.description || intro,
      minutes: Math.max(1, Math.round(words / 200)),
      updatedAt: entry.data.updatedAt || fs.statSync(abs).mtime,
      entry,
    });
  }

  const sortKey = (a: Article) => a.entry.data.order ?? orderOf.get(`${a.categorySlug}/${a.slug}`) ?? 1000;
  const cats = [...byCategory.values()].filter((c) => c.articles.length);
  for (const c of cats) {
    c.articles.sort((a, b) => sortKey(a) - sortKey(b) || a.title.localeCompare(b.title, 'pt-BR'));
  }
  return cats.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'pt-BR'));
}

export const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(d);

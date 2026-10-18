// Coleção de artigos lida direto de help/support/ (sem cópia).
// Frontmatter é opcional: o que faltar é derivado em src/lib/content.ts
// (título do "# H1", resumo do primeiro parágrafo, categoria da pasta,
// ordem de _categorias.yml, data de atualização do arquivo).
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { SUPPORT_DIR } from './lib/paths.mjs';

const artigos = defineCollection({
  loader: glob({
    base: SUPPORT_DIR,
    // Pasta por artigo (categoria/artigo/artigo.md) ou formato plano (categoria/artigo.md).
    // README.md, IMAGENS.md e pastas "_" ficam de fora.
    pattern: ['[!_.]*/*.md', '[!_.]*/[!_.]*/*.md'],
    generateId: ({ entry }) => entry.replace(/\.md$/i, ''),
  }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    order: z.number().optional(),
    updatedAt: z.coerce.date().optional(),
  }),
});

export const collections = { artigos };

// Templates visuais da proposta e blocos de texto reutilizáveis.
import { z } from 'zod';
import type { Db } from '../lib/db';
import { UserError, checkbox, optionalInt, optionalText, requiredText, tagList } from '../lib/forms';

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
/** Fontes disponíveis (Google Fonts), usadas no editor e no PDF. */
export const FONTES = [
  'Archivo Black', 'Playfair Display', 'Montserrat', 'Open Sans', 'Lora', 'Poppins', 'Roboto', 'Merriweather',
  'Raleway', 'Cormorant Garamond', 'Josefin Sans', 'Libre Baskerville',
] as const;

export const CAMPOS_IMAGEM = ['logo_path', 'capa_imagem_path', 'miolo_imagem_path', 'rodape_logo_path', 'contracapa_imagem_path'] as const;
export type CampoImagem = (typeof CAMPOS_IMAGEM)[number];

const cor = (padrao: string) =>
  z.preprocess((v) => (typeof v === 'string' && v ? v : padrao), z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.'));
const fonte = z.enum(FONTES, { error: 'Fonte inválida.' });

export const templateSchema = z.object({
  nome: requiredText('Informe o nome do template.', 100),
  descricao: optionalText(1000),
  tags: tagList(),
  fonte_titulo: fonte,
  fonte_corpo: fonte,
  cor_fundo: cor('#FFFFFF'),
  cor_texto_primaria: cor('#444444'),
  cor_texto_secundaria: cor('#E35336'),
  capa_ativa: checkbox(),
  capa_titulo: requiredText('Informe o título da capa.', 120),
  capa_conteudo: optionalText(500),
  miolo_titulo: requiredText('Informe o título das páginas de conteúdo.', 120),
  miolo_introducao: optionalText(2000),
  rodape_titulo: optionalText(120),
  rodape_conteudo: optionalText(500),
  contracapa_ativa: checkbox(),
  contracapa_titulo: optionalText(120),
  contracapa_conteudo: optionalText(1000),
  padrao: checkbox(),
});

export type TemplateInput = z.infer<typeof templateSchema>;

export interface Template extends TemplateInput {
  id: string;
  logo_path: string | null;
  capa_imagem_path: string | null;
  miolo_imagem_path: string | null;
  rodape_logo_path: string | null;
  contracapa_imagem_path: string | null;
  updated_at: Date;
}

const COLUNAS = `id, nome, descricao, tags, fonte_titulo, fonte_corpo, cor_fundo, cor_texto_primaria, cor_texto_secundaria,
  capa_ativa, capa_titulo, capa_conteudo, miolo_titulo, miolo_introducao, rodape_titulo, rodape_conteudo,
  contracapa_ativa, contracapa_titulo, contracapa_conteudo, padrao, logo_path, capa_imagem_path, miolo_imagem_path,
  rodape_logo_path, contracapa_imagem_path, updated_at`;

export async function listarTemplates(db: Db, busca: string | null = null): Promise<Template[]> {
  const { rows } = await db.query<Template>(
    `SELECT ${COLUNAS} FROM orcamento_templates
      WHERE $1::text IS NULL OR nome ILIKE $1 OR descricao ILIKE $1 OR array_to_string(tags, ' ') ILIKE $1
      ORDER BY padrao DESC, lower(nome)`,
    [busca]
  );
  return rows;
}

export async function carregarTemplate(db: Db, id: string): Promise<Template> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new UserError('Template não encontrado.');
  const { rows } = await db.query<Template>(`SELECT ${COLUNAS} FROM orcamento_templates WHERE id = $1`, [id]);
  if (!rows[0]) throw new UserError('Template não encontrado.');
  return rows[0];
}

/** Template escolhido para o orçamento ou, se não houver, o padrão da empresa. */
export async function templateDaProposta(db: Db, templateId: string | null): Promise<Template> {
  const { rows } = await db.query<Template>(
    `SELECT ${COLUNAS} FROM orcamento_templates
      WHERE id = $1::uuid OR padrao
      ORDER BY (id = $1::uuid) DESC NULLS LAST LIMIT 1`,
    [templateId]
  );
  if (rows[0]) return rows[0];
  const todos = await listarTemplates(db);
  if (!todos[0]) throw new UserError('Cadastre um template de proposta em Templates.');
  return todos[0];
}

export async function salvarTemplate(
  db: Db,
  tenantId: string,
  id: string | null,
  input: TemplateInput,
  imagens: Partial<Record<CampoImagem, string | null>>
): Promise<{ id: string; imagensAntigas: string[] }> {
  if (input.padrao) await db.query('UPDATE orcamento_templates SET padrao = false WHERE padrao AND id IS DISTINCT FROM $1', [id]);
  const campos = Object.keys(templateSchema.shape) as (keyof TemplateInput)[];
  const imgCampos = Object.keys(imagens) as CampoImagem[];
  const valores = [...campos.map((c) => input[c]), ...imgCampos.map((c) => imagens[c])];

  if (id) {
    const antigo = await carregarTemplate(db, id);
    if (antigo.padrao && !input.padrao) {
      throw new UserError('Defina outro template como padrão em vez de desmarcar este.');
    }
    const sets = [...campos, ...imgCampos].map((c, i) => `${c} = $${i + 1}`).join(', ');
    await db.query(`UPDATE orcamento_templates SET ${sets}, updated_at = now() WHERE id = $${valores.length + 1}`, [...valores, id]);
    return { id, imagensAntigas: imgCampos.map((c) => antigo[c]).filter((p): p is string => Boolean(p) && !Object.values(imagens).includes(p)) };
  }

  const { rows: existentes } = await db.query<{ n: number }>('SELECT count(*) AS n FROM orcamento_templates');
  const padrao = input.padrao || existentes[0].n === 0;
  const colunas = [...campos, ...imgCampos, 'tenant_id'];
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO orcamento_templates (${colunas.join(', ')}) VALUES (${colunas.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    [...campos.map((c) => (c === 'padrao' ? padrao : input[c])), ...imgCampos.map((c) => imagens[c]), tenantId]
  );
  return { id: rows[0].id, imagensAntigas: [] };
}

export async function excluirTemplate(db: Db, id: string): Promise<string[]> {
  const t = await carregarTemplate(db, id);
  if (t.padrao) throw new UserError('O template padrão não pode ser excluído. Defina outro como padrão antes.');
  await db.query('UPDATE orcamentos SET template_id = NULL WHERE template_id = $1', [id]);
  await db.query('DELETE FROM orcamento_templates WHERE id = $1', [id]);
  const orfas: string[] = [];
  for (const p of CAMPOS_IMAGEM.map((c) => t[c]).filter((x): x is string => Boolean(x))) {
    const { rows } = await db.query(
      'SELECT 1 FROM orcamento_templates WHERE $1 IN (logo_path, capa_imagem_path, miolo_imagem_path, rodape_logo_path, contracapa_imagem_path)',
      [p]
    );
    if (!rows.length) orfas.push(p);
  }
  return orfas;
}

export async function duplicarTemplate(db: Db, id: string): Promise<string> {
  const t = await carregarTemplate(db, id);
  let nome = `${t.nome} (cópia)`;
  for (let i = 2; ; i++) {
    const { rows } = await db.query('SELECT 1 FROM orcamento_templates WHERE lower(nome) = lower($1)', [nome]);
    if (!rows.length) break;
    nome = `${t.nome} (cópia ${i})`;
  }
  // As imagens são compartilhadas com o original (mesmo arquivo); só são apagadas quando nenhum template as usa.
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO orcamento_templates (tenant_id, nome, descricao, tags, fonte_titulo, fonte_corpo, cor_fundo,
       cor_texto_primaria, cor_texto_secundaria, capa_ativa, capa_titulo, capa_conteudo, miolo_titulo, miolo_introducao,
       rodape_titulo, rodape_conteudo, contracapa_ativa, contracapa_titulo, contracapa_conteudo, padrao,
       logo_path, capa_imagem_path, miolo_imagem_path, rodape_logo_path, contracapa_imagem_path)
     SELECT tenant_id, $2, descricao, tags, fonte_titulo, fonte_corpo, cor_fundo, cor_texto_primaria, cor_texto_secundaria,
            capa_ativa, capa_titulo, capa_conteudo, miolo_titulo, miolo_introducao, rodape_titulo, rodape_conteudo,
            contracapa_ativa, contracapa_titulo, contracapa_conteudo, false,
            logo_path, capa_imagem_path, miolo_imagem_path, rodape_logo_path, contracapa_imagem_path
       FROM orcamento_templates WHERE id = $1 RETURNING id`,
    [id, nome]
  );
  return rows[0].id;
}

// ---------------------------------------------------------------------------
// Blocos de texto
// ---------------------------------------------------------------------------
export const PAGINAS_BLOCO = {
  cardapio: 'Cardápio (após os cardápios)',
  bebidas: 'Bebidas',
  staff: 'Staff',
  informacoes: 'Informações complementares',
  condicoes: 'Condições gerais',
} as const;

export type PaginaBloco = keyof typeof PAGINAS_BLOCO;

export const blocoSchema = z.object({
  titulo: requiredText('Informe o título do bloco.', 150),
  texto: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().max(10_000, 'Texto muito longo.')),
  pagina: z.enum(Object.keys(PAGINAS_BLOCO) as [PaginaBloco, ...PaginaBloco[]], { error: 'Selecione a página do bloco.' }),
  ativo_por_padrao: checkbox(),
  ordem: optionalInt(),
});

export interface Bloco {
  id: string;
  titulo: string;
  texto: string;
  pagina: PaginaBloco;
  ativo_por_padrao: boolean;
  ordem: number;
}

export async function listarBlocos(db: Db, filtros: { busca?: string | null; pagina?: string | null } = {}): Promise<Bloco[]> {
  const { rows } = await db.query<Bloco>(
    `SELECT id, titulo, texto, pagina, ativo_por_padrao, ordem FROM orcamento_blocos_info
      WHERE ($1::text IS NULL OR titulo ILIKE $1 OR texto ILIKE $1) AND ($2::text IS NULL OR pagina = $2)
      ORDER BY array_position(ARRAY['cardapio','bebidas','staff','informacoes','condicoes']::text[], pagina), ordem, lower(titulo)`,
    [filtros.busca ?? null, filtros.pagina || null]
  );
  return rows;
}

export async function salvarBloco(db: Db, tenantId: string, id: string | null, input: z.infer<typeof blocoSchema>): Promise<string> {
  if (id) {
    const res = await db.query(
      `UPDATE orcamento_blocos_info SET titulo = $1, texto = $2, pagina = $3, ativo_por_padrao = $4,
              ordem = COALESCE($5, ordem), updated_at = now()
        WHERE id = $6`,
      [input.titulo, input.texto, input.pagina, input.ativo_por_padrao, input.ordem, id]
    );
    if (!res.rowCount) throw new UserError('Bloco não encontrado.');
    return id;
  }
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO orcamento_blocos_info (tenant_id, titulo, texto, pagina, ativo_por_padrao, ordem)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, (SELECT COALESCE(max(ordem), 0) + 1 FROM orcamento_blocos_info)))
     RETURNING id`,
    [tenantId, input.titulo, input.texto, input.pagina, input.ativo_por_padrao, input.ordem]
  );
  return rows[0].id;
}

export async function excluirBloco(db: Db, id: string) {
  const res = await db.query('DELETE FROM orcamento_blocos_info WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Bloco não encontrado.');
}

// ---------------------------------------------------------------------------
// Salvamento a partir do formulário (com upload/remoção das imagens)
// ---------------------------------------------------------------------------
export async function salvarTemplateDoFormulario(
  db: Db,
  tenantId: string,
  id: string | null,
  data: Record<string, unknown>,
  raw: FormData,
  storage: {
    saveUpload: (tenantId: string, folder: string, file: File) => Promise<string>;
    removeFile: (tenantId: string, key: string) => Promise<void>;
  }
): Promise<string> {
  const input = templateSchema.parse(data);
  const imagens: Partial<Record<CampoImagem, string | null>> = {};
  const enviados: string[] = [];
  try {
    for (const campo of CAMPOS_IMAGEM) {
      const arquivo = raw.get(campo);
      if (arquivo instanceof File && arquivo.size > 0) {
        const caminho = await storage.saveUpload(tenantId, 'templates', arquivo);
        enviados.push(caminho);
        imagens[campo] = caminho;
      } else if (data[`remover_${campo}`] === 'on') {
        imagens[campo] = null;
      }
    }
  } catch (err) {
    for (const c of enviados) await storage.removeFile(tenantId, c);
    throw new UserError(err instanceof Error ? err.message : 'Falha ao enviar a imagem.');
  }
  const { id: salvo, imagensAntigas } = await salvarTemplate(db, tenantId, id, input, imagens);
  // Arquivos substituídos não são mais referenciados por este template; só apaga se nenhum outro usa
  for (const antigo of imagensAntigas) {
    const { rows } = await db.query(
      `SELECT 1 FROM orcamento_templates WHERE $1 IN (logo_path, capa_imagem_path, miolo_imagem_path, rodape_logo_path, contracapa_imagem_path)`,
      [antigo]
    );
    if (!rows.length) await storage.removeFile(tenantId, antigo);
  }
  return salvo;
}

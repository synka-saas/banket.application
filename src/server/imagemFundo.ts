// Galeria de imagens de fundo do template (capa, páginas de conteúdo, contracapa) geradas por IA.
// A geração em qualidade alta passa de um minuto (acima do timeout do Nginx), então roda em segundo plano:
// o pedido vira uma linha em template_fundos_ia ("gerando") e a tela acompanha pela listagem. Como o status fica
// no banco, dá para trocar de página e voltar; a imagem pronta fica na galeria para ser escolhida em qualquer template.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { withTenant, type Db } from '../lib/db';
import { UserError } from '../lib/forms';
import { openAiImagem } from '../lib/openai';
import { removeFile, saveFile } from '../lib/storage';

/** Proporção do A4 (210 × 297) em ~200 dpi */
const TAMANHO_A4 = '1664x2352';
const MAX_SIMULTANEAS = 2;
/** Por página, quantas imagens a galeria mostra */
const POR_PAGINA = 12;

export const PAGINAS_FUNDO = ['capa', 'miolo', 'contracapa'] as const;
export type PaginaFundo = (typeof PAGINAS_FUNDO)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const imagemFundoSchema = z.object({
  pagina: z.enum(PAGINAS_FUNDO),
  cores: z.object({ cor_fundo: hex, cor_texto_primaria: hex, cor_texto_secundaria: hex }),
});

export type PedidoImagemFundo = z.infer<typeof imagemFundoSchema>;

export interface FundoIa {
  id: string;
  pagina: PaginaFundo;
  status: 'gerando' | 'pronto' | 'erro';
  arquivo_path: string | null;
  erro: string | null;
  created_at: Date;
}

const USO: Record<PaginaFundo, string> = {
  capa:
    'Front cover of the proposal. The logo and a short title will be placed over the CENTER of the page, so keep a ' +
    'calm, clean, fairly uniform area in the middle; concentrate decorative elements toward the edges and corners.',
  miolo:
    'Background for the INNER CONTENT pages, which carry dense text and price tables over the whole page. It must be ' +
    'very subtle, light and low-contrast: almost the entire page is a plain, even tone of the background color; only ' +
    'faint, delicate decorative touches near the edges or corners. Nothing may compete with text legibility.',
  contracapa:
    'Back cover of the proposal. A short closing text and the logo will be placed in the center, so keep a calm area ' +
    'in the middle and put the decorative elements toward the edges.',
};

function montarPrompt({ pagina, cores }: PedidoImagemFundo): string {
  return [
    'Full-bleed portrait A4 background artwork for a commercial proposal of a catering / buffet / events company.',
    USO[pagina],
    `Color palette: dominant background ${cores.cor_fundo}; accents inspired by ${cores.cor_texto_secundaria} and ` +
      `${cores.cor_texto_primaria}, used softly and harmoniously.`,
    'Style: elegant, refined, premium, contemporary editorial design; subtle textures (paper, watercolor, soft ' +
      'gradients, fine line botanical or culinary motifs) are welcome.',
    'The artwork must cover the whole canvas edge to edge, with no borders, frames, mockups, shadows or perspective.',
    'Absolutely no text, letters, numbers, logos, watermarks, people or faces.',
    'High resolution, crisp, print quality.',
  ].join('\n');
}

/** Gerações "presas" (instância reiniciada no meio, ex.: deploy) viram erro para não girar para sempre. */
async function encerrarInterrompidas(db: Db) {
  await db.query(
    `UPDATE template_fundos_ia SET status = 'erro', erro = 'A geração foi interrompida. Gere novamente.', updated_at = now()
      WHERE status = 'gerando' AND created_at < now() - interval '6 minutes'`
  );
}

export async function listarFundos(db: Db): Promise<FundoIa[]> {
  await encerrarInterrompidas(db);
  const { rows } = await db.query<FundoIa>(
    `SELECT id, pagina, status, arquivo_path, erro, created_at FROM (
       SELECT *, row_number() OVER (PARTITION BY pagina ORDER BY created_at DESC) AS n FROM template_fundos_ia
     ) f WHERE n <= $1 ORDER BY created_at DESC`,
    [POR_PAGINA]
  );
  return rows;
}

/** Registra o pedido; a geração em si começa com processarFundo depois do COMMIT. */
export async function registrarFundo(db: Db, tenantId: string, usuarioId: string, pedido: PedidoImagemFundo): Promise<string> {
  await encerrarInterrompidas(db);
  const { rows: ativas } = await db.query<{ n: number }>(`SELECT count(*) AS n FROM template_fundos_ia WHERE status = 'gerando'`);
  if (ativas[0].n >= MAX_SIMULTANEAS) throw new UserError('Já há imagens sendo geradas. Aguarde terminarem.');
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO template_fundos_ia (tenant_id, pagina, cores, criado_por) VALUES ($1, $2, $3, $4) RETURNING id`,
    [tenantId, pedido.pagina, JSON.stringify(pedido.cores), usuarioId]
  );
  return rows[0].id;
}

/** Gera a imagem, grava no disco do tenant e atualiza a linha. Roda solto (sem request), com conexão própria. */
export async function processarFundo(tenantId: string, id: string, pedido: PedidoImagemFundo): Promise<void> {
  try {
    const imagem = await openAiImagem({ prompt: montarPrompt(pedido), tamanho: TAMANHO_A4 });
    const caminho = await saveFile(tenantId, `templates/ia/${randomUUID()}.jpg`, imagem);
    const atualizada = await withTenant(tenantId, (db) =>
      db.query(`UPDATE template_fundos_ia SET status = 'pronto', arquivo_path = $2, updated_at = now() WHERE id = $1`, [id, caminho])
    );
    // Excluída da galeria enquanto gerava: o arquivo não tem dono
    if (!atualizada.rowCount) await removeFile(tenantId, caminho);
  } catch (err) {
    const mensagem = err instanceof UserError ? err.message : 'Não foi possível gerar a imagem.';
    if (!(err instanceof UserError)) console.error('[imagem-fundo]', err);
    await withTenant(tenantId, (db) =>
      db.query(`UPDATE template_fundos_ia SET status = 'erro', erro = $2, updated_at = now() WHERE id = $1`, [id, mensagem])
    ).catch((e) => console.error('[imagem-fundo] falha ao registrar erro', e));
  }
}

/** Arquivo referenciado por algum template ou pela galeria (não pode ser apagado do disco). */
export async function arquivoEmUso(db: Db, caminho: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM orcamento_templates
      WHERE $1 IN (logo_path, capa_imagem_path, miolo_imagem_path, rodape_logo_path, contracapa_imagem_path)
     UNION ALL
     SELECT 1 FROM template_fundos_ia WHERE arquivo_path = $1
     LIMIT 1`,
    [caminho]
  );
  return rows.length > 0;
}

/** Caminho da imagem da galeria escolhida para uma página do template. */
export async function arquivoDoFundo(db: Db, id: string, pagina: PaginaFundo): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new UserError('Imagem da galeria não encontrada.');
  const { rows } = await db.query<{ arquivo_path: string }>(
    `SELECT arquivo_path FROM template_fundos_ia WHERE id = $1 AND pagina = $2 AND status = 'pronto'`,
    [id, pagina]
  );
  if (!rows[0]?.arquivo_path) throw new UserError('Imagem da galeria não encontrada.');
  return rows[0].arquivo_path;
}

/** Tira a imagem da galeria; devolve o arquivo a apagar do disco se nenhum template o usa. */
export async function excluirFundo(db: Db, id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new UserError('Imagem da galeria não encontrada.');
  const { rows } = await db.query<{ arquivo_path: string | null; status: string }>(
    `DELETE FROM template_fundos_ia WHERE id = $1 RETURNING arquivo_path, status`,
    [id]
  );
  if (!rows[0]) throw new UserError('Imagem da galeria não encontrada.');
  const caminho = rows[0].arquivo_path;
  return caminho && !(await arquivoEmUso(db, caminho)) ? caminho : null;
}

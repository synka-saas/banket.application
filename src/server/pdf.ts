// Geração do PDF da proposta: o Chromium abre as páginas /print/* (com token de curta duração),
// imprime capa, miolo e contracapa separadamente e o pdf-lib junta tudo num arquivo só.
import fs from 'node:fs';
import { chromium, type Browser } from 'playwright-core';
import { PDFDocument } from 'pdf-lib';
import type { Db } from '../lib/db';
import type { SessionUser } from '../lib/auth';
import { UserError } from '../lib/forms';
import { signPrintToken } from '../lib/printToken';
import { readFile, saveFile } from '../lib/storage';
import { registrarTimeline } from './timeline';
import { templateDaProposta } from './templates';

type Parte = 'capa' | 'miolo' | 'contracapa';

let browserPromise: Promise<Browser> | null = null;

function caminhoChromium(): string | undefined {
  const candidatos = [process.env.CHROMIUM_PATH, '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean) as string[];
  return candidatos.find((c) => fs.existsSync(c));
}

async function navegador(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({
        executablePath: caminhoChromium(),
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
      })
      .then((b) => {
        b.on('disconnected', () => (browserPromise = null));
        return b;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

function urlInterna(caminho: string): string {
  return `http://127.0.0.1:${process.env.PORT ?? 4321}${caminho}`;
}

async function imprimir(caminho: string, token: string, partes: Parte[]): Promise<Uint8Array> {
  const browser = await navegador();
  const contexto = await browser.newContext();
  try {
    const final = await PDFDocument.create();
    for (const parte of partes) {
      const page = await contexto.newPage();
      const res = await page.goto(urlInterna(`${caminho}?parte=${parte}&token=${encodeURIComponent(token)}`), {
        waitUntil: 'networkidle',
        timeout: 30_000,
      });
      if (!res?.ok()) throw new Error(`Falha ao renderizar a proposta (${parte}): HTTP ${res?.status()}`);
      await page.evaluate(() => document.fonts.ready);
      const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
      await page.close();
      const doc = await PDFDocument.load(pdf);
      const paginas = await final.copyPages(doc, doc.getPageIndices());
      paginas.forEach((p) => final.addPage(p));
    }
    final.setTitle('Proposta de orçamento');
    final.setCreator('Banket');
    return await final.save();
  } finally {
    await contexto.close();
  }
}

function partesDoTemplate(t: { capa_ativa: boolean; contracapa_ativa: boolean }): Parte[] {
  return [...(t.capa_ativa ? (['capa'] as Parte[]) : []), 'miolo', ...(t.contracapa_ativa ? (['contracapa'] as Parte[]) : [])];
}

export interface PdfGerado {
  arquivo: Uint8Array;
  nome: string;
}

/**
 * PDF de uma versão do orçamento. Versões congeladas reaproveitam o PDF já gerado;
 * a versão em edição é sempre gerada de novo (reflete as últimas alterações).
 */
export async function pdfDaVersao(db: Db, user: SessionUser, eventoId: string, numero: number): Promise<PdfGerado> {
  const { rows } = await db.query<{ id: string; congelada: boolean; pdf_path: string | null; template_id: string | null; titulo: string | null }>(
    `SELECT v.id, v.congelada, v.pdf_path, o.template_id, e.titulo
       FROM orcamento_versoes v
       JOIN orcamentos o ON o.id = v.orcamento_id
       JOIN eventos e ON e.id = o.evento_id
      WHERE o.evento_id = $1 AND v.numero = $2`,
    [eventoId, numero]
  );
  const v = rows[0];
  if (!v) throw new UserError('Versão do orçamento não encontrada.');
  const nome = `Proposta - ${(v.titulo ?? 'evento').replace(/[\\/:*?"<>|]/g, '-')} - v${String(numero).padStart(2, '0')}.pdf`;

  if (v.congelada && v.pdf_path) {
    const existente = await readFile(user.tenantId, v.pdf_path);
    if (existente) return { arquivo: new Uint8Array(existente), nome };
  }

  const template = await templateDaProposta(db, v.template_id);
  const token = await signPrintToken({ tenantId: user.tenantId, alvo: 'versao', id: v.id });
  const arquivo = await imprimir(`/print/orcamento/${v.id}`, token, partesDoTemplate(template));

  const caminho = `orcamentos/${eventoId}/v${numero}.pdf`;
  await saveFile(user.tenantId, caminho, arquivo);
  await db.query('UPDATE orcamento_versoes SET pdf_path = $1, pdf_gerado_em = now() WHERE id = $2', [caminho, v.id]);
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId, usuarioId: user.id },
    'pdf_gerado',
    `PDF da proposta gerado (versão ${String(numero).padStart(2, '0')})`
  );
  return { arquivo, nome };
}

/** PDF de exemplo de um template (conteúdo fictício), para conferir o visual. */
export async function pdfExemploTemplate(db: Db, tenantId: string, templateId: string): Promise<PdfGerado> {
  const { rows } = await db.query<{ nome: string; capa_ativa: boolean; contracapa_ativa: boolean }>(
    'SELECT nome, capa_ativa, contracapa_ativa FROM orcamento_templates WHERE id = $1',
    [templateId]
  );
  if (!rows[0]) throw new UserError('Template não encontrado.');
  const token = await signPrintToken({ tenantId, alvo: 'template', id: templateId });
  const arquivo = await imprimir(`/print/template/${templateId}`, token, partesDoTemplate(rows[0]));
  return { arquivo, nome: `Exemplo - ${rows[0].nome}.pdf` };
}

export function respostaPdf(pdf: PdfGerado, download = true): Response {
  return new Response(new Uint8Array(pdf.arquivo), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(pdf.nome)}`,
      'Cache-Control': 'no-store',
    },
  });
}

import type { APIRoute } from 'astro';
import { withTenant } from '../../../../lib/db';
import { signPrintToken } from '../../../../lib/printToken';
import { eventoExiste } from '../../../../server/eventos';
import { contextoOrcamento } from '../../../../server/orcamento';
import { imprimir, respostaPdf } from '../../../../server/pdf';

// Lista de compras da versão em PDF (lista simples); ?ver=1 abre no navegador em vez de baixar.
export const GET: APIRoute = async ({ params, url, locals }) => {
  const id = params.id!;
  const ctx = await withTenant(locals.user.tenantId, async (db) =>
    (await eventoExiste(db, id)) ? contextoOrcamento(db, id, url.searchParams.get('versao')) : null
  );
  if (!ctx?.versao) return new Response(null, { status: 404 });
  const token = await signPrintToken({ tenantId: locals.user.tenantId, alvo: 'compras', id: ctx.versao.id });
  const titulo = `Lista de compras - ${(ctx.evento.titulo ?? 'evento').replace(/[\\/:*?"<>|]/g, '-')} - v${String(ctx.versao.numero).padStart(2, '0')}`;
  const arquivo = await imprimir(`/print/compras/${ctx.versao.id}`, token, ['miolo'], titulo);
  return respostaPdf({ arquivo, nome: `${titulo}.pdf` }, url.searchParams.get('ver') !== '1');
};

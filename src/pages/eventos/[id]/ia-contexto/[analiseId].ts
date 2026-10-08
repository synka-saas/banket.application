import type { APIRoute } from 'astro';
import { withTenant } from '../../../../lib/db';

// Contexto (.md) enviado à IA numa análise do evento (Assistente de Negociação IA ou Assistente de Orçamentos IA).
export const GET: APIRoute = async ({ params, locals }) => {
  const { id, analiseId } = params;
  if (!/^[0-9a-f-]{36}$/i.test(id ?? '') || !/^[0-9a-f-]{36}$/i.test(analiseId ?? '')) return new Response(null, { status: 404 });
  const linha = await withTenant(locals.user.tenantId, async (db) => {
    const { rows } = await db.query<{ contexto_md: string; tipo: string; created_at: Date }>(
      'SELECT contexto_md, tipo, created_at FROM ia_analises WHERE id = $1 AND evento_id = $2',
      [analiseId, id]
    );
    return rows[0] ?? null;
  });
  if (!linha) return new Response(null, { status: 404 });
  const nome = `${linha.tipo === 'negociacao' ? 'negociacao' : 'orcamento'}-${new Date(linha.created_at).toISOString().slice(0, 10)}.md`;
  return new Response(linha.contexto_md, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${nome}"`, 'Cache-Control': 'no-store' },
  });
};

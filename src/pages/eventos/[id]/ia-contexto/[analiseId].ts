import type { APIRoute } from 'astro';
import { withTenant } from '../../../../lib/db';
import { filtroDeAutor, type TipoAnalise } from '../../../../server/ia/comum';

// Contexto (.md) enviado à IA numa análise do evento (Assistente de Negociação IA ou Assistente de Orçamentos IA).
export const GET: APIRoute = async ({ params, locals }) => {
  const { id, analiseId } = params;
  if (!/^[0-9a-f-]{36}$/i.test(id ?? '') || !/^[0-9a-f-]{36}$/i.test(analiseId ?? '')) return new Response(null, { status: 404 });
  const linha = await withTenant(locals.user.tenantId, async (db) => {
    const { rows } = await db.query<{ contexto_md: string; tipo: TipoAnalise; created_at: Date; usuario_id: string | null }>(
      'SELECT contexto_md, tipo, created_at, usuario_id FROM ia_analises WHERE id = $1 AND evento_id = $2',
      [analiseId, id]
    );
    const a = rows[0];
    // Mesma regra da tela: o contexto da negociação tem e-mails do Inbox que o usuário comum pode não enxergar
    const autor = a ? filtroDeAutor(locals.user, a.tipo) : null;
    return a && (!autor || a.usuario_id === autor) ? a : null;
  });
  if (!linha) return new Response(null, { status: 404 });
  const nome = `${linha.tipo === 'negociacao' ? 'negociacao' : 'orcamento'}-${new Date(linha.created_at).toISOString().slice(0, 10)}.md`;
  return new Response(linha.contexto_md, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${nome}"`, 'Cache-Control': 'no-store' },
  });
};

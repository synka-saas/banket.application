import type { APIRoute } from 'astro';
import { withTenant } from '../../../../lib/db';
import { eventoExiste } from '../../../../server/eventos';
import { exportarListaComprasCsv } from '../../../../server/orcamento';

// Lista de compras da versão em CSV (separador ";" para abrir direto no Excel em português)
export const GET: APIRoute = async ({ params, url, locals }) => {
  const id = params.id!;
  const resultado = await withTenant(locals.user.tenantId, async (db) =>
    (await eventoExiste(db, id)) ? exportarListaComprasCsv(db, id, url.searchParams.get('versao')) : null
  );
  if (!resultado) return new Response(null, { status: 404 });
  return new Response(resultado.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lista-de-compras-v${String(resultado.numero).padStart(2, '0')}.csv"`,
    },
  });
};

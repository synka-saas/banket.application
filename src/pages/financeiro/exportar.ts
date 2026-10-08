import type { APIRoute } from 'astro';
import { withTenant } from '../../lib/db';
import { searchTerm } from '../../lib/pagination';
import { hojeSaoPaulo } from '../../lib/datas';
import { exportarContasCsv, filtrosContasDaUrl } from '../../server/financeiro';

// Exporta as contas a receber/pagar do filtro atual em CSV (separador ";" para o Excel em português). Owner/admin (middleware).
export const GET: APIRoute = async ({ url, locals }) => {
  const tipo = url.searchParams.get('tipo') === 'pagar' ? 'pagar' : 'receber';
  const csv = await withTenant(locals.user.tenantId, (db) => exportarContasCsv(db, filtrosContasDaUrl(url, tipo, searchTerm(url))));
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contas-a-${tipo}-${hojeSaoPaulo()}.csv"`,
    },
  });
};

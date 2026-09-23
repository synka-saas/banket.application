import type { APIRoute } from 'astro';
import { withTenant } from '../../lib/db';
import { searchTerm } from '../../lib/pagination';
import { exportarEventosCsv, filtrosDaUrl } from '../../server/eventos';

// Exporta os eventos filtrados em CSV (separador ";" para abrir direto no Excel em português)
export const GET: APIRoute = async ({ url, locals }) => {
  const csv = await withTenant(locals.user.tenantId, (db) => exportarEventosCsv(db, filtrosDaUrl(url, searchTerm(url))));
  const data = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="eventos-${data}.csv"`,
    },
  });
};

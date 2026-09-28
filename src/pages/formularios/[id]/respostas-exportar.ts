import type { APIRoute } from 'astro';
import { withTenant } from '../../../lib/db';
import { carregarFormulario, respostasParaExportar } from '../../../server/formularios';

// CSV das respostas (UX-078): colunas fixas + uma coluna por pergunta respondida no recorte.
// Separador ";" para o Excel em português; ?de=&ate= limitam o período.
export const GET: APIRoute = async ({ params, url, locals }) => {
  const dados = await withTenant(locals.user.tenantId, async (db) => {
    const formulario = await carregarFormulario(db, params.id!).catch(() => null);
    if (!formulario) return null;
    const respostas = await respostasParaExportar(db, params.id!, {
      de: url.searchParams.get('de') || null,
      ate: url.searchParams.get('ate') || null,
    });
    return { formulario, respostas };
  });
  if (!dados) return new Response(null, { status: 404 });

  const colunas: string[] = [];
  for (const r of dados.respostas) {
    for (const linha of r.dados) if (!colunas.includes(linha.rotulo)) colunas.push(linha.rotulo);
  }
  const escapar = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const linhas = [
    ['Recebida em', ...colunas].map(escapar).join(';'),
    ...dados.respostas.map((r) => {
      const porRotulo = new Map(r.dados.map((l) => [l.rotulo, l.valor]));
      return [r.created_at.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), ...colunas.map((c) => porRotulo.get(c) ?? '')]
        .map(escapar)
        .join(';');
    }),
  ];
  // BOM para o Excel reconhecer UTF-8
  return new Response(`﻿${linhas.join('\r\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="respostas-${dados.formulario.slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};

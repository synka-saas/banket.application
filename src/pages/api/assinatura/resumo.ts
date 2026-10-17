import type { APIRoute } from 'astro';
import { jsonEndpoint } from '../../../lib/api';
import { withTenant } from '../../../lib/db';
import { carregarCobranca, temAssinatura } from '../../../server/assinatura';

// GET — a tela de faturamento consulta na volta do Checkout até o webhook confirmar a assinatura.
export const GET: APIRoute = jsonEndpoint(async ({ locals }) => {
  const c = await withTenant(locals.user.tenantId, (db) => carregarCobranca(db, locals.user.tenantId));
  return { assinatura: c ? temAssinatura(c) : false, plano: c?.plano_nome ?? null, pendente: c?.plano_pendente_id ?? null };
});

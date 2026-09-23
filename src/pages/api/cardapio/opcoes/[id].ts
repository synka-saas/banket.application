import { jsonEndpoint, readJson } from '../../../../lib/api';
import { withTenant } from '../../../../lib/db';
import { setFlash } from '../../../../lib/flash';
import { carregarOpcao, duplicarOpcao, excluirOpcao, opcaoSchema, salvarOpcao } from '../../../../server/cardapio';

export const GET = jsonEndpoint(async ({ params, locals }) =>
  withTenant(locals.user.tenantId, (db) => carregarOpcao(db, params.id!))
);

export const PUT = jsonEndpoint(async ({ params, request, locals, cookies }) => {
  const input = opcaoSchema.parse(await readJson(request));
  const { tenantId } = locals.user;
  await withTenant(tenantId, (db) => salvarOpcao(db, tenantId, params.id!, input));
  setFlash(cookies, 'success', 'Cardápio atualizado.');
  return { id: params.id };
});

export const DELETE = jsonEndpoint(async ({ params, locals, cookies }) => {
  await withTenant(locals.user.tenantId, (db) => excluirOpcao(db, params.id!));
  setFlash(cookies, 'success', 'Cardápio removido.');
  return { ok: true };
});

// Duplica a opção (POST /api/cardapio/opcoes/:id)
export const POST = jsonEndpoint(async ({ params, locals, cookies }) => {
  const { tenantId } = locals.user;
  const id = await withTenant(tenantId, (db) => duplicarOpcao(db, tenantId, params.id!));
  setFlash(cookies, 'success', 'Cardápio duplicado.');
  return { id };
});

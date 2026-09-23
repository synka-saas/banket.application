import { jsonEndpoint, readJson } from '../../../../lib/api';
import { withTenant } from '../../../../lib/db';
import { setFlash } from '../../../../lib/flash';
import { opcaoSchema, salvarOpcao } from '../../../../server/cardapio';

// Cria uma opção de cardápio
export const POST = jsonEndpoint(async ({ request, locals, cookies }) => {
  const input = opcaoSchema.parse(await readJson(request));
  const { tenantId } = locals.user;
  const id = await withTenant(tenantId, (db) => salvarOpcao(db, tenantId, null, input));
  setFlash(cookies, 'success', 'Cardápio criado.');
  return { id };
});

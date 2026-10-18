import { jsonEndpoint } from '../../../lib/api';
import { withTenant } from '../../../lib/db';
import { UserError } from '../../../lib/forms';
import { permitir } from '../../../lib/rateLimit';
import { sugerirEnderecos } from '../../../server/busca/onboarding';

// Sugestões de endereço do perfil (varinha da etapa 1), geradas pela OpenAI e conferidas como livres no servidor
export const POST = jsonEndpoint(async ({ locals }) => {
  if (!permitir(`ia-endereco:${locals.user.tenantId}`, 20, 10 * 60_000)) {
    throw new UserError('Muitas sugestões em pouco tempo. Aguarde alguns minutos.');
  }
  const sugestoes = await withTenant(locals.user.tenantId, (db) => sugerirEnderecos(db, locals.user));
  if (!sugestoes.length) throw new UserError('Não encontramos endereços livres agora. Digite um endereço ou tente de novo.');
  return { sugestoes };
});

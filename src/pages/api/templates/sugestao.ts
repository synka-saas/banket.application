import { jsonEndpoint, readJson } from '../../../lib/api';
import { UserError } from '../../../lib/forms';
import { permitir } from '../../../lib/rateLimit';
import { sugerirIdentidade, sugestaoSchema } from '../../../server/identidadeVisual';

// Sugestão de fontes/cores do template a partir do logotipo (IA)
export const POST = jsonEndpoint(async ({ request, locals }) => {
  const pedido = sugestaoSchema.parse(await readJson(request));
  if (!permitir(`ia-template:${locals.user.tenantId}`, 40, 10 * 60_000)) {
    throw new UserError('Muitas sugestões em pouco tempo. Aguarde alguns minutos.');
  }
  return sugerirIdentidade(pedido);
});

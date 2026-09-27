import { jsonEndpoint, readJson } from '../../../../lib/api';
import { UserError } from '../../../../lib/forms';
import { permitir } from '../../../../lib/rateLimit';
import { iniciarImagemFundo, imagemFundoSchema } from '../../../../server/imagemFundo';

// Inicia a geração de uma imagem de fundo por IA (o resultado é consultado em GET /api/templates/imagem-fundo/:id)
export const POST = jsonEndpoint(async ({ request, locals }) => {
  const pedido = imagemFundoSchema.parse(await readJson(request));
  const { tenantId } = locals.user;
  if (!permitir(`ia-imagem:${tenantId}`, 15, 60 * 60_000)) {
    throw new UserError('Limite de imagens geradas por hora atingido. Tente mais tarde.');
  }
  return { id: iniciarImagemFundo(tenantId, pedido) };
});

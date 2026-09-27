import { jsonEndpoint } from '../../../../lib/api';
import { consultarImagemFundo } from '../../../../server/imagemFundo';

// Andamento da geração da imagem de fundo
export const GET = jsonEndpoint(async ({ params, locals }) => consultarImagemFundo(locals.user.tenantId, params.id ?? ''));

import { jsonEndpoint } from '../../../../lib/api';
import { withTenant } from '../../../../lib/db';
import { removeFile } from '../../../../lib/storage';
import { excluirFundo } from '../../../../server/imagemFundo';

// Remove uma imagem da galeria (o arquivo só é apagado se nenhum template o usa)
export const DELETE = jsonEndpoint(async ({ params, locals }) => {
  const { tenantId } = locals.user;
  const arquivo = await withTenant(tenantId, (db) => excluirFundo(db, params.id ?? ''));
  if (arquivo) await removeFile(tenantId, arquivo);
  return { ok: true };
});

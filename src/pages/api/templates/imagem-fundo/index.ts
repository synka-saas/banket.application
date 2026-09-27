import { jsonEndpoint, readJson } from '../../../../lib/api';
import { withTenant } from '../../../../lib/db';
import { UserError } from '../../../../lib/forms';
import { permitir } from '../../../../lib/rateLimit';
import { fileUrl } from '../../../../lib/storage';
import { imagemFundoSchema, listarFundos, processarFundo, registrarFundo } from '../../../../server/imagemFundo';

// Galeria de fundos gerados por IA (a tela consulta enquanto houver algum "gerando")
export const GET = jsonEndpoint(async ({ locals }) => {
  const { tenantId } = locals.user;
  const fundos = await withTenant(tenantId, (db) => listarFundos(db));
  return {
    fundos: fundos.map((f) => ({
      id: f.id,
      pagina: f.pagina,
      status: f.status,
      erro: f.erro,
      url: f.arquivo_path ? fileUrl(tenantId, f.arquivo_path) : null,
    })),
  };
});

// Pede uma nova imagem; a geração continua no servidor mesmo que o usuário saia da página
export const POST = jsonEndpoint(async ({ request, locals }) => {
  const pedido = imagemFundoSchema.parse(await readJson(request));
  const { tenantId, id: usuarioId } = locals.user;
  if (!permitir(`ia-imagem:${tenantId}`, 15, 60 * 60_000)) {
    throw new UserError('Limite de imagens geradas por hora atingido. Tente mais tarde.');
  }
  const id = await withTenant(tenantId, (db) => registrarFundo(db, tenantId, usuarioId, pedido));
  void processarFundo(tenantId, id, pedido);
  return { id };
});

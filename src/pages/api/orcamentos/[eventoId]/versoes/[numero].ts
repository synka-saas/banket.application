import { jsonEndpoint, readJson } from '../../../../../lib/api';
import { withTenant } from '../../../../../lib/db';
import { UserError } from '../../../../../lib/forms';
import { salvarVersao } from '../../../../../server/orcamento';

// Salvamento automático da versão em edição (parcial). O servidor recalcula e devolve os totais.
export const PUT = jsonEndpoint(async ({ params, request, locals }) => {
  const numero = Number.parseInt(params.numero ?? '', 10);
  if (!Number.isInteger(numero) || numero < 1) throw new UserError('Versão inválida.');
  const corpo = await readJson(request);
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) throw new UserError('Dados inválidos.');
  const conteudo = await withTenant(locals.user.tenantId, (db) =>
    salvarVersao(db, params.eventoId!, numero, corpo as Record<string, unknown>)
  );
  return { totais: conteudo.totais };
});

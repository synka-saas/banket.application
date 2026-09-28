import { z } from 'zod';
import { jsonEndpoint, readJson } from '../../../../lib/api';
import { withTenant } from '../../../../lib/db';
import { moverEvento } from '../../../../server/eventos';

const bodySchema = z.object({
  status_id: z.uuid('Status inválido.'),
  // Complemento pedido ao mover para uma etapa recusada/aprovada (UX-104)
  motivo_perda: z.string().max(500).optional(),
  fechado_em: z.iso.date('Data de fechamento inválida.').optional(),
});

// Move o evento para outra coluna do quadro de vendas (arrastar, menu ⋯ ou faixa do resumo)
export const PATCH = jsonEndpoint(async ({ params, request, locals }) => {
  const { status_id, motivo_perda, fechado_em } = bodySchema.parse(await readJson(request));
  await withTenant(locals.user.tenantId, (db) =>
    moverEvento(db, locals.user, params.id!, status_id, { motivo: motivo_perda ?? null, fechadoEm: fechado_em ?? null })
  );
  return { ok: true };
});

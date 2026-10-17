import type { APIRoute } from 'astro';
import { z } from 'zod';
import { jsonEndpoint, readJson } from '../../../lib/api';
import { withTenant } from '../../../lib/db';
import { setFlash } from '../../../lib/flash';
import { trocarPlanoDaAssinatura } from '../../../server/assinatura';
import { escolherPlanoNoTeste } from '../../../server/planos';

// PUT { plano_id, ciclo } — com assinatura: troca no Stripe (ajuste proporcional na próxima fatura);
// sem assinatura, durante o teste: troca o plano do teste sem pagamento (o prazo não muda).
const schema = z.object({ plano_id: z.uuid('Escolha um plano.'), ciclo: z.enum(['mes', 'ano']).default('mes') });

export const PUT: APIRoute = jsonEndpoint(async ({ request, locals, cookies }) => {
  const { plano_id, ciclo } = schema.parse(await readJson(request));
  if (locals.plano?.assinaturaViva) {
    const plano = await trocarPlanoDaAssinatura(locals.user, plano_id, ciclo);
    setFlash(cookies, 'success', `Plano alterado para ${plano.nome}. O ajuste proporcional entra na próxima fatura.`);
    return { ok: true, redirect: '/configuracoes/financeiro' };
  }
  const plano = await withTenant(locals.user.tenantId, (db) => escolherPlanoNoTeste(db, locals.user, plano_id));
  setFlash(cookies, 'success', `Seu teste agora é do plano ${plano.nome}. O prazo do teste continua o mesmo.`);
  return { ok: true, redirect: '/configuracoes/financeiro' };
});

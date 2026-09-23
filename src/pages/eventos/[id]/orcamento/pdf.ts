import type { APIRoute } from 'astro';
import { withTenant } from '../../../../lib/db';
import { userMessage } from '../../../../lib/forms';
import { setFlash } from '../../../../lib/flash';
import { pdfDaVersao, respostaPdf } from '../../../../server/pdf';
import { carregarOrcamento } from '../../../../server/orcamento';

// Baixa (ou abre, com ?ver=1) o PDF da proposta de uma versão; padrão: versão atual.
export const GET: APIRoute = async ({ params, url, locals, cookies, redirect }) => {
  const eventoId = params.id!;
  try {
    const pdf = await withTenant(locals.user.tenantId, async (db) => {
      const orc = await carregarOrcamento(db, eventoId);
      if (!orc) throw new Error('Este evento ainda não tem orçamento.');
      const pedida = Number.parseInt(url.searchParams.get('versao') ?? '', 10);
      const numero = orc.versoes.some((v) => v.numero === pedida) ? pedida : orc.versao_atual;
      return pdfDaVersao(db, locals.user, eventoId, numero);
    });
    return respostaPdf(pdf, url.searchParams.get('ver') !== '1');
  } catch (err) {
    setFlash(cookies, 'error', err instanceof Error && err.message.startsWith('Este evento') ? err.message : userMessage(err, 'Não foi possível gerar o PDF.'));
    return redirect(`/eventos/${eventoId}/orcamento`);
  }
};

import type { APIRoute } from 'astro';
import { withTenant } from '../../../../../lib/db';
import { setFlash } from '../../../../../lib/flash';
import { userMessage } from '../../../../../lib/forms';
import { carregarDocumento, pdfDoDocumento } from '../../../../../server/documentos';
import { respostaPdf } from '../../../../../server/pdf';

// PDF de um documento gerado no evento (?ver=1 abre no navegador em vez de baixar)
export const GET: APIRoute = async ({ params, url, locals, cookies, redirect }) => {
  try {
    const pdf = await withTenant(locals.user.tenantId, async (db) => {
      const d = await carregarDocumento(db, params.docId!);
      if (d.evento_id !== params.id) throw new Error('Documento de outro evento.');
      return pdfDoDocumento(db, locals.user.tenantId, d.id);
    });
    return respostaPdf(pdf, url.searchParams.get('ver') !== '1');
  } catch (err) {
    setFlash(cookies, 'error', userMessage(err, 'Não foi possível abrir o PDF.'));
    return redirect(`/eventos/${params.id}/documentos`);
  }
};

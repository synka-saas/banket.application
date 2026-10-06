import type { APIRoute } from 'astro';
import { withTenant } from '../../../lib/db';
import { setFlash } from '../../../lib/flash';
import { userMessage } from '../../../lib/forms';
import { pdfExemploModelo } from '../../../server/documentos';
import { respostaPdf } from '../../../server/pdf';

// PDF de exemplo de um modelo de documento (dados fictícios), aberto no navegador
export const GET: APIRoute = async ({ params, locals, cookies, redirect }) => {
  try {
    const pdf = await withTenant(locals.user.tenantId, (db) => pdfExemploModelo(db, locals.user.tenantId, params.id!));
    return respostaPdf(pdf, false);
  } catch (err) {
    setFlash(cookies, 'error', userMessage(err, 'Não foi possível gerar o PDF de exemplo.'));
    return redirect('/documentos');
  }
};

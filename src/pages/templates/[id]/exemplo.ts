import type { APIRoute } from 'astro';
import { withTenant } from '../../../lib/db';
import { setFlash } from '../../../lib/flash';
import { userMessage } from '../../../lib/forms';
import { pdfExemploTemplate, respostaPdf } from '../../../server/pdf';

// PDF de exemplo do template, aberto no navegador para conferir o visual
export const GET: APIRoute = async ({ params, locals, cookies, redirect }) => {
  try {
    const pdf = await withTenant(locals.user.tenantId, (db) => pdfExemploTemplate(db, locals.user.tenantId, params.id!));
    return respostaPdf(pdf, false);
  } catch (err) {
    setFlash(cookies, 'error', userMessage(err, 'Não foi possível gerar o PDF de exemplo.'));
    return redirect(`/templates/${params.id}`);
  }
};

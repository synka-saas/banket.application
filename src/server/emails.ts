// Modelos de e-mail transacional (HTML simples, compatível com clientes de e-mail).
import { escapeHtml } from '../lib/html';

interface EmailLayout {
  titulo: string;
  paragrafos: string[];
  cta?: { texto: string; url: string };
  rodape?: string;
}

export function emailLayout({ titulo, paragrafos, cta, rodape }: EmailLayout): { html: string; text: string } {
  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#f7f7f7;font-family:'Open Sans',Arial,sans-serif;color:#444">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:8px;overflow:hidden">
        <tr><td style="background:#E35336;padding:20px 32px;color:#fff;font-size:22px;font-weight:700">banket</td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:20px;color:#444">${escapeHtml(titulo)}</h1>
          ${paragrafos.map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6">${escapeHtml(p)}</p>`).join('')}
          ${
            cta
              ? `<p style="margin:28px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#E35336;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:4px">${escapeHtml(cta.texto)}</a></p>
                 <p style="margin:0;font-size:12px;color:#888">Se o botão não funcionar, copie e cole este link no navegador:<br>${escapeHtml(cta.url)}</p>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:16px 32px;background:#fafafa;font-size:12px;color:#888">${escapeHtml(
          rodape ?? 'Você recebeu este e-mail porque há uma ação associada ao seu endereço no Banket.'
        )}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = [titulo, '', ...paragrafos, ...(cta ? ['', `${cta.texto}: ${cta.url}`] : [])].join('\n');
  return { html, text };
}

// Modelos de e-mail transacional (HTML simples, compatível com clientes de e-mail).
import { escapeHtml } from '../lib/html';

interface EmailLayout {
  titulo: string;
  paragrafos: string[];
  cta?: { texto: string; url: string };
  rodape?: string;
}

export function emailLayout({ titulo, paragrafos, cta, rodape }: EmailLayout): { html: string; text: string } {
  // Clientes de e-mail não carregam webfont nem variáveis CSS: cores da paleta do design system em hex e
  // General Sans com fallback do sistema. Títulos e botão usam peso 600 porque Arial/Segoe UI não têm o 500.
  const fonte = "font-family:'General Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#FAF6F2;${fonte};color:#54483F">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F2;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E5DBD1;border-radius:12px;overflow:hidden">
        <tr><td style="padding:28px 32px 0;${fonte};font-size:22px;line-height:1;font-weight:600;letter-spacing:-0.01em;color:#C9432A">banket</td></tr>
        <tr><td style="padding:24px 32px 32px;${fonte}">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;color:#241D19">${escapeHtml(titulo)}</h1>
          ${paragrafos.map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#54483F">${escapeHtml(p)}</p>`).join('')}
          ${
            cta
              ? `<p style="margin:28px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#C9432A;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;line-height:1.2;padding:13px 24px;border-radius:8px">${escapeHtml(cta.texto)}</a></p>
                 <p style="margin:0;font-size:12px;line-height:1.5;color:#807265">Se o botão não funcionar, copie e cole este link no navegador:<br><span style="color:#A9361F;word-break:break-all">${escapeHtml(cta.url)}</span></p>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:16px 32px;background:#FDFBF8;border-top:1px solid #EDE5DD;${fonte};font-size:12px;line-height:1.5;color:#807265">${escapeHtml(
          rodape ?? 'Você recebeu este e-mail porque há uma ação associada ao seu endereço no Banket.'
        )}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = [titulo, '', ...paragrafos, ...(cta ? ['', `${cta.texto}: ${cta.url}`] : [])].join('\n');
  return { html, text };
}

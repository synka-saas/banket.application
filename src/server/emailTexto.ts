// Utilidades de texto dos e-mails enviados pelo usuário (proposta e respostas do Inbox).
import { z } from 'zod';
import { escapeHtml } from '../lib/html';

/** Lista de destinatários digitada (vírgula, ponto e vírgula ou espaço), de 1 a 5 e-mails válidos. */
export const listaEmails = z.preprocess(
  (v) =>
    String(v ?? '')
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  z.array(z.email('E-mail do destinatário inválido.')).min(1, 'Informe o e-mail do destinatário.').max(5, 'Máximo de 5 destinatários.')
);

/** Mensagem em texto simples → HTML de e-mail (parágrafos por linha em branco, quebras preservadas). */
export function mensagemHtml(mensagem: string, empresa: string, rodape = `Proposta enviada por ${empresa}.`): string {
  const paragrafos = mensagem
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#54483F">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  // Cores da paleta do design system em hex (clientes de e-mail não leem variáveis CSS nem webfont)
  const fonte = "font-family:'General Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
  return (
    `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#FAF6F2;${fonte};color:#54483F">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F2;padding:32px 16px"><tr><td align="center">` +
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E5DBD1;border-radius:12px;overflow:hidden">` +
    `<tr><td style="padding:32px 32px 18px;${fonte};text-align:left">${paragrafos}</td></tr>` +
    `<tr><td style="padding:16px 32px;background:#FDFBF8;border-top:1px solid #EDE5DD;${fonte};text-align:left"><p style="margin:0;font-size:12px;line-height:1.5;color:#807265">${escapeHtml(rodape)}</p></td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}

/** Endereço puro (minúsculo) de "Nome <endereco>" ou de um endereço já puro. */
export function enderecoPuro(valor: string): string {
  const m = valor.match(/<([^>]+)>/);
  return (m ? m[1] : valor).trim().toLowerCase();
}

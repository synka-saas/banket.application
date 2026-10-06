// Envio de e-mail pela API do Resend. Sem RESEND_API_KEY (desenvolvimento) ou com destinatários só de domínios
// reservados (e2e), o e-mail é apenas registrado no log, para que os fluxos (convite, recuperação de senha) sigam testáveis.

export interface MailAttachment {
  filename: string;
  content: Uint8Array;
  contentType?: string;
}

export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Um ou mais endereços de resposta (o Inbox usa o endereço da conversa) */
  replyTo?: string | string[];
  /** Só o nome de exibição do remetente; o endereço continua o de MAIL_FROM */
  fromName?: string;
  /** Cabeçalhos extras (In-Reply-To, References…) */
  headers?: Record<string, string>;
  attachments?: MailAttachment[];
}

export interface MailResult {
  id: string;
  delivered: boolean;
}

function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

export function appUrl(path = ''): string {
  const base = (env('APP_URL') ?? 'http://localhost:4321').replace(/\/$/, '');
  return `${base}${path}`;
}

/** Domínios reservados (RFC 2606/6761) nunca recebem e-mail: usados pelos testes e2e, inclusive em produção. */
export const dominioReservado = (email: string) => /@(?:[\w-]+\.)*(?:example\.(?:com|net|org)|[\w-]+\.(?:test|invalid|example))$/i.test(email.trim());

const REMETENTE_PADRAO = 'Banket <nao-responda@banket.com.br>';

/** Endereço puro de um remetente no formato "Nome <endereco>" (ou já puro). */
export function enderecoDe(remetente: string): string {
  const m = remetente.match(/<([^>]+)>/);
  return (m ? m[1] : remetente).trim();
}

/** Remetente com nome de exibição próprio sobre o endereço de MAIL_FROM. */
export function remetente(fromName?: string): string {
  const base = env('MAIL_FROM') ?? REMETENTE_PADRAO;
  if (!fromName) return base;
  const nome = fromName.replace(/["<>\r\n]/g, '').trim();
  return nome ? `"${nome}" <${enderecoDe(base)}>` : base;
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const apiKey = env('RESEND_API_KEY');
  const from = remetente(message.fromName);
  const destinatarios = [message.to].flat();
  const replyTo = message.replyTo === undefined ? undefined : [message.replyTo].flat();

  if (!apiKey || destinatarios.every(dominioReservado)) {
    console.info(
      `[mail:dev] De: ${from} | Para: ${destinatarios.join(', ')}${replyTo ? ` | Reply-To: ${replyTo.join(', ')}` : ''} | Assunto: ${message.subject}\n${message.text ?? message.html}`
    );
    return { id: 'dev', delivered: false };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: destinatarios,
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: replyTo,
      headers: message.headers,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString('base64'),
        content_type: a.contentType,
      })),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Falha ao enviar e-mail (${res.status}): ${detail}`);
  }
  const body = (await res.json()) as { id: string };
  return { id: body.id, delivered: true };
}

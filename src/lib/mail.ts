// Envio de e-mail pela API do Resend. Sem RESEND_API_KEY (desenvolvimento), o e-mail
// é apenas registrado no log, para que os fluxos (convite, recuperação de senha) sigam testáveis.

export interface MailAttachment {
  filename: string;
  content: Uint8Array;
}

export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
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

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const apiKey = env('RESEND_API_KEY');
  const from = env('MAIL_FROM') ?? 'Banket <nao-responda@banket.com.br>';

  if (!apiKey) {
    console.info(
      `[mail:dev] Para: ${[message.to].flat().join(', ')} | Assunto: ${message.subject}\n${message.text ?? message.html}`
    );
    return { id: 'dev', delivered: false };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [message.to].flat(),
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: message.replyTo,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString('base64'),
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

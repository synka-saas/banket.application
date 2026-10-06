// Leitura de e-mails recebidos pelo Resend (Receiving API). O webhook traz só os metadados; o corpo, os cabeçalhos
// e os anexos (URL temporária de 1 h) vêm destas chamadas. A interface é injetável para os testes.

export interface EmailRecebido {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string | null;
  html: string | null;
  text: string | null;
  message_id: string | null;
  headers: Record<string, string>;
}

export interface AnexoRecebido {
  id: string;
  filename: string;
  content_type: string | null;
  size: number | null;
  download_url: string;
}

export interface ResendReceiving {
  obterEmail(id: string): Promise<EmailRecebido>;
  listarAnexos(id: string): Promise<AnexoRecebido[]>;
  baixar(url: string): Promise<Uint8Array>;
}

function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

async function resendGet<T>(path: string): Promise<T> {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY não configurada: não é possível ler e-mails recebidos.');
  const res = await fetch(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`Resend ${path} respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' && v ? [v] : []);

export const resendReceiving: ResendReceiving = {
  async obterEmail(id) {
    const e = await resendGet<Record<string, unknown>>(`/emails/receiving/${encodeURIComponent(id)}`);
    const headers: Record<string, string> = {};
    if (e.headers && typeof e.headers === 'object') {
      for (const [k, v] of Object.entries(e.headers as Record<string, unknown>)) {
        if (typeof v === 'string') headers[k.toLowerCase()] = v;
        else if (Array.isArray(v)) headers[k.toLowerCase()] = v.filter((x) => typeof x === 'string').join(' ');
      }
    }
    return {
      id: String(e.id ?? id),
      from: typeof e.from === 'string' ? e.from : '',
      to: lista(e.to),
      cc: lista(e.cc),
      subject: typeof e.subject === 'string' ? e.subject : null,
      html: typeof e.html === 'string' ? e.html : null,
      text: typeof e.text === 'string' ? e.text : null,
      message_id: typeof e.message_id === 'string' ? e.message_id : null,
      headers,
    };
  },
  async listarAnexos(id) {
    const r = await resendGet<{ data?: unknown[] } | unknown[]>(`/emails/receiving/${encodeURIComponent(id)}/attachments`);
    const itens = Array.isArray(r) ? r : Array.isArray(r.data) ? r.data : [];
    return itens
      .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
      .filter((a) => typeof a.download_url === 'string')
      .map((a) => ({
        id: String(a.id ?? ''),
        filename: typeof a.filename === 'string' && a.filename ? a.filename : 'anexo',
        content_type: typeof a.content_type === 'string' ? a.content_type : null,
        size: typeof a.size === 'number' ? a.size : null,
        download_url: a.download_url as string,
      }));
  },
  async baixar(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao baixar anexo (${res.status}).`);
    return new Uint8Array(await res.arrayBuffer());
  },
};

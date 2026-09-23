// Utilitários para montar HTML com segurança fora do template Astro
// (ex.: células de tabela com botões de ação).

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Marca um trecho como HTML confiável (já escapado). Qualquer outro valor é renderizado como texto. */
export interface RawHtml {
  __html: string;
}

export function raw(html: string): RawHtml {
  return { __html: html };
}

export function isRawHtml(value: unknown): value is RawHtml {
  return typeof value === 'object' && value !== null && '__html' in value;
}

function render(value: unknown): string {
  if (Array.isArray(value)) return value.map(render).join('');
  if (isRawHtml(value)) return value.__html;
  if (value === false || value === null || value === undefined) return '';
  return escapeHtml(value);
}

/**
 * Template tag que escapa automaticamente as interpolações: html`<b>${nome}</b>`.
 * Aceita arrays (ex.: resultado de .map com html``) e ignora false/null/undefined.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): RawHtml {
  let out = strings[0];
  values.forEach((v, i) => {
    out += render(v) + strings[i + 1];
  });
  return raw(out);
}

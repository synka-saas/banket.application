import type { AstroGlobal } from 'astro';
import { setFlash } from './flash';
import { formToObject, userMessage } from './forms';

type FormValues = Record<string, unknown>;

/**
 * Trata um POST de formulário no padrão POST → redirect → GET:
 * executa `handler` com os campos do form, grava a mensagem (sucesso ou erro) e redireciona
 * para a própria URL (ou para a URL retornada em `redirect`).
 */
export async function handleFormPost(
  Astro: AstroGlobal,
  handler: (data: FormValues, raw: FormData) => Promise<string | { message: string; redirect?: string }>,
  opts: { arrays?: string[] } = {}
): Promise<Response> {
  const raw = await Astro.request.formData();
  const data = formToObject(raw, opts.arrays);
  let destino = Astro.url.pathname + Astro.url.search;
  try {
    const result = await handler(data, raw);
    const message = typeof result === 'string' ? result : result.message;
    if (typeof result !== 'string' && result.redirect) destino = result.redirect;
    if (message) setFlash(Astro.cookies, 'success', message);
  } catch (err) {
    setFlash(Astro.cookies, 'error', userMessage(err));
  }
  return Astro.redirect(destino);
}

/** Lê o id do formulário (vazio = criação). */
export function formId(data: FormValues): string | null {
  return typeof data.id === 'string' && data.id ? data.id : null;
}

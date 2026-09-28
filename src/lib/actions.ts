import type { AstroGlobal } from 'astro';
import { setFlash } from './flash';
import { fieldErrors, formToObject, userMessage } from './forms';

type FormValues = Record<string, unknown>;

/** O Drawer envia por fetch pedindo JSON: em erro, o painel continua aberto com o que foi digitado. */
export function querJson(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('application/json');
}

/** Resposta de formulário para envio por fetch: sucesso (flash + destino) ou erro com mensagens por campo. */
export function respostaFormulario(
  resultado: { ok: true; redirect: string } | { ok: false; error: string; fields: Record<string, string> }
): Response {
  return new Response(JSON.stringify(resultado), {
    status: resultado.ok ? 200 : 400,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * Trata um POST de formulário no padrão POST → redirect → GET:
 * executa `handler` com os campos do form, grava a mensagem (sucesso ou erro) e redireciona
 * para a própria URL (ou para a URL retornada em `redirect`).
 * Pedido com Accept: application/json (Drawer): responde JSON; o flash de sucesso segue no cookie para a próxima página.
 */
export async function handleFormPost(
  Astro: AstroGlobal,
  handler: (data: FormValues, raw: FormData) => Promise<string | { message: string; redirect?: string }>,
  opts: { arrays?: string[] } = {}
): Promise<Response> {
  const raw = await Astro.request.formData();
  const data = formToObject(raw, opts.arrays);
  const json = querJson(Astro.request);
  let destino = Astro.url.pathname + Astro.url.search;
  try {
    const result = await handler(data, raw);
    const message = typeof result === 'string' ? result : result.message;
    if (typeof result !== 'string' && result.redirect) destino = result.redirect;
    if (message) setFlash(Astro.cookies, 'success', message);
    if (json) return respostaFormulario({ ok: true, redirect: destino });
  } catch (err) {
    if (json) return respostaFormulario({ ok: false, error: userMessage(err), fields: fieldErrors(err) });
    setFlash(Astro.cookies, 'error', userMessage(err));
  }
  return Astro.redirect(destino);
}

/** Lê o id do formulário (vazio = criação). */
export function formId(data: FormValues): string | null {
  return typeof data.id === 'string' && data.id ? data.id : null;
}

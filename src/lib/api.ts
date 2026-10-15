import type { APIContext } from 'astro';
import { userMessage } from './forms';
import { ErroPlano } from './planos/gating';

/**
 * Envolve um endpoint JSON: devolve o resultado com status 200 (ou o Response retornado)
 * e converte erros de negócio/validação em 400 com { error }.
 */
export function jsonEndpoint(handler: (ctx: APIContext) => Promise<unknown>) {
  return async (ctx: APIContext): Promise<Response> => {
    try {
      const result = await handler(ctx);
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true });
    } catch (err) {
      // Fora do plano / limite: 403 padronizado (o navegador abre o painel de upsell)
      if (err instanceof ErroPlano) return Response.json(err.toJSON(), { status: 403 });
      return Response.json({ error: userMessage(err) }, { status: 400 });
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error('JSON inválido'), { code: '22P02' });
  }
}

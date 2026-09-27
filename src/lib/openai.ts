// Chamada mínima à API da OpenAI (Chat Completions) com imagem e resposta em JSON estruturado.
import { UserError } from './forms';

function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

export function openAiConfigurada(): boolean {
  return Boolean(env('OPENAI_TOKEN') || env('OPENAI_API_KEY'));
}

interface PedidoJson {
  sistema: string;
  usuario: string;
  /** data URL (PNG/JPEG/WebP) enviada junto com o texto */
  imagem?: string;
  /** nome e JSON Schema da resposta (modo strict) */
  nomeSchema: string;
  schema: Record<string, unknown>;
}

export async function openAiJson<T>(pedido: PedidoJson): Promise<T> {
  const chave = env('OPENAI_TOKEN') || env('OPENAI_API_KEY');
  if (!chave) throw new UserError('A integração com IA não está configurada (OPENAI_TOKEN).');

  const conteudo: unknown[] = [{ type: 'text', text: pedido.usuario }];
  if (pedido.imagem) conteudo.push({ type: 'image_url', image_url: { url: pedido.imagem, detail: 'low' } });

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env('OPENAI_MODEL') || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: pedido.sistema },
          { role: 'user', content: conteudo },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: pedido.nomeSchema, strict: true, schema: pedido.schema },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    console.error('[openai] falha de rede', err);
    throw new UserError('Não foi possível falar com a IA agora. Tente novamente.');
  }

  if (!res.ok) {
    console.error('[openai]', res.status, (await res.text()).slice(0, 500));
    throw new UserError('A IA não respondeu à solicitação. Tente novamente em instantes.');
  }
  const corpo = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] };
  const texto = corpo.choices?.[0]?.message?.content;
  if (!texto) throw new UserError('A IA não conseguiu analisar a imagem.');
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new UserError('Resposta inesperada da IA.');
  }
}

// Recebe o envio do formulário público (sem sessão): honeypot + limite por IP, depois cria cliente e evento.
import type { APIRoute } from 'astro';
import { readJson } from '../../../../lib/api';
import { userMessage } from '../../../../lib/forms';
import { ipDaRequisicao, permitir } from '../../../../lib/rateLimit';
import { formularioPublico, receberResposta } from '../../../../server/formularios';

const LIMITE_ENVIOS = 5;
const JANELA_MS = 10 * 60 * 1000;

export const POST: APIRoute = async ({ params, request, clientAddress }) => {
  const ip = ipDaRequisicao(request, clientAddress);
  if (!permitir(`form:${params.slug}:${ip}`, LIMITE_ENVIOS, JANELA_MS)) {
    return Response.json({ error: 'Muitos envios em sequência. Aguarde alguns minutos e tente novamente.' }, { status: 429 });
  }

  try {
    const formulario = await formularioPublico(params.slug ?? '');
    if (!formulario) return Response.json({ error: 'Este formulário não está disponível.' }, { status: 404 });

    const dados = await readJson(request);
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
      return Response.json({ error: 'Dados inválidos.' }, { status: 400 });
    }
    // Honeypot: campo invisível que só robôs preenchem. Responde como sucesso para não dar pistas.
    const { _website, ...respostas } = dados as Record<string, unknown>;
    if (typeof _website === 'string' && _website.trim()) return Response.json({ ok: true });

    await receberResposta(formulario, respostas, ip);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: userMessage(err, 'Não foi possível enviar o formulário. Tente novamente.') }, { status: 400 });
  }
};

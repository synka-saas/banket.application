import type { APIRoute } from 'astro';
import { ipDaRequisicao, permitir } from '../../../lib/rateLimit';
import { registrarMetrica, type CampoMetrica } from '../../../server/busca/publico';

// Cliques no perfil público (POST JSON {perfil, tipo}): "contato" = abriu os contatos ou tocou no WhatsApp/telefone/
// e-mail; "orcamento" = abriu o formulário de orçamento. Conta uma vez por IP, perfil e tipo a cada 30 min; robôs não
// contam. Sempre 204: a página nunca depende da resposta.
const CAMPOS: Record<string, CampoMetrica> = { contato: 'cliques_contato', orcamento: 'cliques_orcamento' };

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let corpo: { perfil?: unknown; tipo?: unknown } = {};
  try {
    corpo = await request.json();
  } catch {
    /* corpo inválido: ignora */
  }
  const perfil = typeof corpo.perfil === 'string' && /^[0-9a-f-]{36}$/i.test(corpo.perfil) ? corpo.perfil : null;
  const campo = typeof corpo.tipo === 'string' && Object.hasOwn(CAMPOS, corpo.tipo) ? CAMPOS[corpo.tipo] : undefined;
  const ip = ipDaRequisicao(request, clientAddress);
  // Primeiro o limite por IP (60 por minuto), depois a contagem única por perfil: UUIDs inventados não enchem o limitador
  if (!perfil || !campo || !permitir(`metrica-ip:${ip}`, 60, 60_000)) return new Response(null, { status: 204 });
  if (permitir(`metrica:${ip}:${perfil}:${campo}`, 1, 30 * 60_000)) {
    await registrarMetrica([perfil], campo, request.headers.get('user-agent'));
  }
  return new Response(null, { status: 204 });
};

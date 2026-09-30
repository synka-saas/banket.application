// Chamados de suporte. O helpdesk fica no Manager Hwesta (HCP v1, lib/hwesta): aqui ficam a validação dos
// formulários e a regra de quem vê o quê — cada usuário enxerga os chamados que abriu na empresa atual.
import { z } from 'zod';
import type { SessionUser } from '../lib/auth';
import { UserError, requiredText } from '../lib/forms';
import { adapter, tickets } from '../lib/hwesta';

export const PRIORIDADES = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' } as const;
export type Prioridade = keyof typeof PRIORIDADES;

// Valores aceitos pelo helpdesk; o rótulo é o que aparece para o usuário
export const CATEGORIAS = {
  Dúvida: 'Dúvida',
  Bug: 'Problema ou erro',
  Financeiro: 'Financeiro',
  Sugestão: 'Sugestão',
  Outro: 'Outro assunto',
} as const;
export type Categoria = keyof typeof CATEGORIAS;

export const chamadoSchema = z.object({
  assunto: requiredText('Informe o assunto.', 255),
  descricao: requiredText('Descreva o que aconteceu.', 5000),
  categoria: z.enum(Object.keys(CATEGORIAS) as [Categoria], { error: 'Escolha o tipo do chamado.' }),
  prioridade: z.enum(Object.keys(PRIORIDADES) as [Prioridade], { error: 'Escolha a prioridade.' }),
});

export const respostaSchema = z.object({
  mensagem: requiredText('Escreva a mensagem.', 5000),
});

export interface EventoChamado {
  id: number;
  event_type: string;
  author_type: 'client' | 'support' | 'system';
  author_name: string | null;
  content: string | null;
  new_value: string | null;
  created_at: string;
}

export interface Chamado {
  id: number;
  subject: string;
  description: string;
  priority: Prioridade;
  category: string | null;
  user_id: string | null;
  tenant_id: string | null;
  status_name: string | null;
  status_is_final: boolean | null;
  created_at: string;
  updated_at: string;
  events?: EventoChamado[];
}

// O que o cliente acompanha: a conversa e as mudanças de status (atribuição e prioridade são internas do suporte)
const EVENTOS_VISIVEIS = new Set(['message_client', 'message_support', 'status_change']);

const INDISPONIVEL = 'O suporte está indisponível no momento. Tente novamente em instantes.';

const doUsuario = (c: Chamado, user: SessionUser) => c.user_id === user.id && c.tenant_id === user.tenantId;

/** O helpdesk prefixa a descrição com "Usuário: nome (e-mail)" para o atendente; o usuário não precisa ver. */
export const descricaoDoChamado = (c: Pick<Chamado, 'description'>) => c.description.replace(/^Usuário: .*\n\n/, '');

export async function listarChamados(user: SessionUser): Promise<{ chamados: Chamado[]; disponivel: boolean }> {
  const r = await tickets.listByUser(user.id);
  const todos: Chamado[] = r.ok && Array.isArray(r.data?.data) ? r.data.data : [];
  return { chamados: todos.filter((c) => doUsuario(c, user)), disponivel: r.ok };
}

/** Chamado com a conversa; null quando não existe ou não é do usuário nesta empresa. */
export async function carregarChamado(user: SessionUser, id: string): Promise<Chamado | null> {
  if (!/^\d{1,9}$/.test(id)) return null;
  const r = await tickets.get(id);
  if (r.status === 404) return null;
  const chamado: Chamado | undefined = r.data?.data;
  if (!r.ok || !chamado) throw new UserError(INDISPONIVEL);
  if (!doUsuario(chamado, user)) return null;
  return { ...chamado, events: (chamado.events ?? []).filter((e) => EVENTOS_VISIVEIS.has(e.event_type)) };
}

export async function abrirChamado(
  user: SessionUser,
  input: z.infer<typeof chamadoSchema>,
  contexto: { url?: string | null; userAgent?: string | null } = {}
): Promise<Chamado> {
  const r = await tickets.create({
    subject: input.assunto,
    description: input.descricao,
    priority: input.prioridade,
    category: input.categoria,
    user_id: user.id,
    tenant_id: user.tenantId,
    user_name: user.nome,
    user_email: user.email,
    context: {
      app_id: adapter.appId,
      app_version: adapter.version,
      role: user.role,
      url: contexto.url ?? null,
      user_agent: contexto.userAgent ?? null,
    },
  });
  if (!r.ok || !r.data?.data) throw new UserError(INDISPONIVEL);
  return r.data.data;
}

export async function responderChamado(user: SessionUser, id: string, input: z.infer<typeof respostaSchema>): Promise<void> {
  const chamado = await carregarChamado(user, id);
  if (!chamado) throw new UserError('Chamado não encontrado.');
  const r = await tickets.reply(chamado.id, input.mensagem, user.nome);
  if (!r.ok) throw new UserError(INDISPONIVEL);
}

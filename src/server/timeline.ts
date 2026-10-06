// Linha do tempo do evento: registro de tudo o que acontece (criação, edições, status, orçamento, envios…)
// e anotações manuais do comercial (ligação, visita, degustação…), com data de retorno opcional.
import { z } from 'zod';
import type { Db } from '../lib/db';
import type { SessionUser } from '../lib/auth';
import { optionalDate, requiredText } from '../lib/forms';

export type TipoTimeline =
  | 'criado'
  | 'editado'
  | 'status'
  | 'checklist'
  | 'orcamento_criado'
  | 'orcamento_versao'
  | 'pdf_gerado'
  | 'email_enviado'
  | 'email_recebido'
  | 'formulario'
  | 'anotacao';

export const ICONES_TIMELINE: Record<string, string> = {
  criado: 'circle-plus',
  editado: 'pencil',
  status: 'layout-kanban',
  checklist: 'check',
  orcamento_criado: 'file-dollar',
  orcamento_versao: 'history',
  pdf_gerado: 'file-text',
  email_enviado: 'send',
  email_recebido: 'mail',
  formulario: 'stack-2',
  anotacao: 'edit',
};

export const TIPOS_ANOTACAO = {
  ligacao: 'Ligação',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  visita: 'Visita',
  degustacao: 'Degustação',
  outro: 'Anotação',
} as const;

export const anotacaoSchema = z.object({
  tipo_contato: z.enum(Object.keys(TIPOS_ANOTACAO) as [keyof typeof TIPOS_ANOTACAO], { error: 'Escolha o tipo da anotação.' }),
  texto: requiredText('Escreva a anotação.', 2000),
  retorno_em: optionalDate(),
});

/** Anotação manual do comercial; `retorno_em` agenda um lembrete que aparece no dashboard. */
export async function registrarAnotacao(db: Db, user: SessionUser, eventoId: string, input: z.infer<typeof anotacaoSchema>) {
  await db.query(
    `INSERT INTO evento_timeline (tenant_id, evento_id, tipo, descricao, dados, usuario_id, retorno_em)
     VALUES ($1, $2, 'anotacao', $3, $4, $5, $6)`,
    [
      user.tenantId,
      eventoId,
      `${TIPOS_ANOTACAO[input.tipo_contato]}: ${input.texto}`,
      { tipo_contato: input.tipo_contato },
      user.id,
      input.retorno_em,
    ]
  );
}

export async function registrarTimeline(
  db: Db,
  evento: { tenantId: string; eventoId: string; usuarioId: string | null },
  tipo: TipoTimeline,
  descricao: string,
  dados: Record<string, unknown> = {}
) {
  await db.query(
    `INSERT INTO evento_timeline (tenant_id, evento_id, tipo, descricao, dados, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [evento.tenantId, evento.eventoId, tipo, descricao, dados, evento.usuarioId]
  );
}

export interface TimelineRow {
  id: string;
  tipo: string;
  descricao: string;
  dados: Record<string, unknown>;
  usuario_nome: string | null;
  retorno_em: string | null;
  created_at: Date;
}

export async function listarTimeline(db: Db, eventoId: string): Promise<TimelineRow[]> {
  const { rows } = await db.query<TimelineRow>(
    `SELECT t.id, t.tipo, t.descricao, t.dados, u.nome AS usuario_nome,
            to_char(t.retorno_em, 'YYYY-MM-DD') AS retorno_em, t.created_at
       FROM evento_timeline t LEFT JOIN usuarios u ON u.id = t.usuario_id
      WHERE t.evento_id = $1
      ORDER BY t.created_at DESC`,
    [eventoId]
  );
  return rows;
}

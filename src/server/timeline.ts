// Linha do tempo do evento: registro de tudo o que acontece (criação, edições, status, orçamento, envios…).
import type { Db } from '../lib/db';

export type TipoTimeline =
  | 'criado'
  | 'editado'
  | 'status'
  | 'checklist'
  | 'orcamento_criado'
  | 'orcamento_versao'
  | 'pdf_gerado'
  | 'email_enviado'
  | 'formulario';

export const ICONES_TIMELINE: Record<string, string> = {
  criado: 'add_circle',
  editado: 'edit',
  status: 'view_kanban',
  checklist: 'check',
  orcamento_criado: 'description',
  orcamento_versao: 'layers',
  pdf_gerado: 'description',
  email_enviado: 'send',
  formulario: 'layers',
};

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
  created_at: Date;
}

export async function listarTimeline(db: Db, eventoId: string): Promise<TimelineRow[]> {
  const { rows } = await db.query<TimelineRow>(
    `SELECT t.id, t.tipo, t.descricao, t.dados, u.nome AS usuario_nome, t.created_at
       FROM evento_timeline t LEFT JOIN usuarios u ON u.id = t.usuario_id
      WHERE t.evento_id = $1
      ORDER BY t.created_at DESC`,
    [eventoId]
  );
  return rows;
}

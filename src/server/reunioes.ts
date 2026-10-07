// Reuniões agendadas pelo sistema na agenda Google do organizador (com sala do Google Meet e convites).
// Só quem ativou a agenda pelo login/vínculo com o Google agenda; editar e cancelar usa a agenda do organizador.
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Db } from '../lib/db';
import type { SessionUser } from '../lib/auth';
import { isAdmin } from '../lib/auth';
import { UserError, optionalText, optionalUuid, requiredText } from '../lib/forms';
import { atualizarEventoAgenda, criarEventoAgenda, excluirEventoAgenda, type DadosEventoAgenda } from '../lib/google';
import { accessTokenAgenda } from './googleConta';
import { registrarTimeline } from './timeline';

export const DURACOES = { 15: '15 minutos', 30: '30 minutos', 45: '45 minutos', 60: '1 hora', 90: '1h30', 120: '2 horas' } as const;

const FUSO = 'America/Sao_Paulo';

const listaEmails = () =>
  z.preprocess(
    (v) =>
      String(Array.isArray(v) ? v.join(',') : (v ?? ''))
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e, i, lista) => e && lista.indexOf(e) === i),
    z.array(z.email('Há um e-mail inválido entre os participantes.')).max(20, 'Até 20 participantes por reunião.')
  );

export const reuniaoSchema = z.object({
  titulo: requiredText('Informe o título da reunião.', 200),
  evento_id: optionalUuid(),
  data: z.iso.date('Informe a data da reunião.'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Informe o horário da reunião.'),
  duracao_min: z.coerce.number().int().min(15, 'Duração mínima de 15 minutos.').max(480, 'Duração máxima de 8 horas.').default(60),
  participantes: listaEmails(),
  local: optionalText(255),
  descricao: optionalText(5000),
});
export type ReuniaoInput = z.infer<typeof reuniaoSchema>;

export interface Reuniao {
  id: string;
  evento_id: string | null;
  evento_titulo: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  usuario_id: string | null;
  organizador_nome: string | null;
  titulo: string;
  descricao: string | null;
  /** "YYYY-MM-DD" e "HH:MM" no fuso de São Paulo */
  data: string;
  hora: string;
  hora_fim: string;
  duracao_min: number;
  inicio: Date;
  fim: Date;
  participantes: string[];
  local: string | null;
  meet_link: string | null;
  google_link: string | null;
  status: 'agendada' | 'cancelada';
}

const SELECT = `
  SELECT r.id, r.evento_id, e.titulo AS evento_titulo, r.cliente_id, c.nome AS cliente_nome, r.usuario_id, u.nome AS organizador_nome,
         r.titulo, r.descricao, r.inicio, r.fim,
         to_char(r.inicio AT TIME ZONE '${FUSO}', 'YYYY-MM-DD') AS data,
         to_char(r.inicio AT TIME ZONE '${FUSO}', 'HH24:MI') AS hora,
         to_char(r.fim AT TIME ZONE '${FUSO}', 'HH24:MI') AS hora_fim,
         (EXTRACT(EPOCH FROM (r.fim - r.inicio)) / 60)::int AS duracao_min,
         r.participantes, r.local, r.meet_link, r.google_link, r.status
    FROM reunioes r
    LEFT JOIN eventos e ON e.id = r.evento_id
    LEFT JOIN clientes c ON c.id = r.cliente_id
    LEFT JOIN usuarios u ON u.id = r.usuario_id`;

export async function carregarReuniao(db: Db, id: string): Promise<Reuniao> {
  const { rows } = await db.query<Reuniao>(`${SELECT} WHERE r.id = $1`, [id]);
  if (!rows[0]) throw new UserError('Reunião não encontrada.');
  return rows[0];
}

export async function listarReunioesDoEvento(db: Db, eventoId: string): Promise<Reuniao[]> {
  const { rows } = await db.query<Reuniao>(`${SELECT} WHERE r.evento_id = $1 ORDER BY r.status, r.inicio DESC`, [eventoId]);
  return rows;
}

/** Reuniões agendadas (não canceladas), próximas ou passadas. */
export async function listarReunioes(db: Db, filtro: 'proximas' | 'passadas', limite = 200): Promise<Reuniao[]> {
  const { rows } = await db.query<Reuniao>(
    `${SELECT} WHERE r.status = 'agendada' AND ${filtro === 'proximas' ? 'r.fim >= now()' : 'r.fim < now()'}
      ORDER BY r.inicio ${filtro === 'proximas' ? 'ASC' : 'DESC'} LIMIT $1`,
    [limite]
  );
  return rows;
}

/** Reuniões agendadas entre duas datas ("YYYY-MM-DD", fuso de São Paulo), para a agenda. */
export async function reunioesNoPeriodo(db: Db, inicio: string, fim: string): Promise<Reuniao[]> {
  const { rows } = await db.query<Reuniao>(
    `${SELECT} WHERE r.status = 'agendada'
        AND r.inicio >= ($1::date::timestamp AT TIME ZONE '${FUSO}')
        AND r.inicio < (($2::date + 1)::timestamp AT TIME ZONE '${FUSO}')
      ORDER BY r.inicio`,
    [inicio, fim]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Datas: "YYYY-MM-DD" + "HH:MM" + minutos → fim ("YYYY-MM-DDTHH:MM:SS" para o Google; o Postgres converte do fuso)
// ---------------------------------------------------------------------------
export function somarMinutos(data: string, hora: string, minutos: number): { data: string; hora: string } {
  const [h, m] = hora.split(':').map(Number);
  const base = new Date(`${data}T00:00:00Z`);
  const total = new Date(base.getTime() + (h * 60 + m + minutos) * 60_000);
  return { data: total.toISOString().slice(0, 10), hora: total.toISOString().slice(11, 16) };
}

function dadosAgenda(input: ReuniaoInput, extra: { eventoTitulo: string | null }): DadosEventoAgenda {
  const fim = somarMinutos(input.data, input.hora, input.duracao_min);
  const descricao = [input.descricao, extra.eventoTitulo ? `Evento: ${extra.eventoTitulo}` : null].filter(Boolean).join('\n\n') || null;
  return {
    titulo: input.titulo,
    descricao,
    local: input.local ?? null,
    inicio: `${input.data}T${input.hora}:00`,
    fim: `${fim.data}T${fim.hora}:00`,
    participantes: input.participantes,
  };
}

async function eventoDaReuniao(db: Db, eventoId: string | null): Promise<{ id: string; titulo: string | null; cliente_id: string | null } | null> {
  if (!eventoId) return null;
  const { rows } = await db.query<{ id: string; titulo: string | null; cliente_id: string | null }>('SELECT id, titulo, cliente_id FROM eventos WHERE id = $1', [eventoId]);
  if (!rows[0]) throw new UserError('Evento não encontrado.', 'evento_id');
  return rows[0];
}

const podeAlterar = (user: SessionUser, r: Reuniao) => isAdmin(user) || r.usuario_id === user.id;

/** Agenda a reunião na agenda Google do usuário (com Meet e convites) e grava no sistema. */
export async function agendarReuniao(db: Db, user: SessionUser, input: ReuniaoInput): Promise<Reuniao> {
  const token = await accessTokenAgenda(user.id);
  const evento = await eventoDaReuniao(db, input.evento_id ?? null);
  const dados = dadosAgenda(input, { eventoTitulo: evento?.titulo ?? null });
  const criado = await criarEventoAgenda(token, dados, crypto.randomUUID());
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO reunioes (tenant_id, evento_id, cliente_id, usuario_id, titulo, descricao, inicio, fim, participantes, local,
                           google_event_id, meet_link, google_link)
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp AT TIME ZONE '${FUSO}', $8::timestamp AT TIME ZONE '${FUSO}', $9, $10, $11, $12, $13)
     RETURNING id`,
    [user.tenantId, evento?.id ?? null, evento?.cliente_id ?? null, user.id, input.titulo, input.descricao ?? null, dados.inicio, dados.fim,
     input.participantes, input.local ?? null, criado.id, criado.meetLink, criado.htmlLink]
  );
  const r = await carregarReuniao(db, rows[0].id);
  if (evento) {
    await registrarTimeline(db, { tenantId: user.tenantId, eventoId: evento.id, usuarioId: user.id }, 'reuniao', `Reunião agendada: "${r.titulo}" em ${dataHoraCurta(r)}`, {
      reuniao_id: r.id, meet_link: r.meet_link,
    });
  }
  return r;
}

export async function atualizarReuniao(db: Db, user: SessionUser, id: string, input: ReuniaoInput): Promise<Reuniao> {
  const atual = await carregarReuniao(db, id);
  if (!podeAlterar(user, atual)) throw new UserError('Só o organizador ou um administrador pode alterar esta reunião.');
  if (atual.status === 'cancelada') throw new UserError('Esta reunião foi cancelada. Agende uma nova.');
  const evento = await eventoDaReuniao(db, input.evento_id ?? null);
  const dados = dadosAgenda(input, { eventoTitulo: evento?.titulo ?? null });
  let meet = atual.meet_link;
  let link = atual.google_link;
  const { rows: g } = await db.query<{ google_event_id: string | null }>('SELECT google_event_id FROM reunioes WHERE id = $1', [id]);
  if (g[0]?.google_event_id && atual.usuario_id) {
    // A alteração sai da agenda do organizador (é lá que o evento e o Meet existem)
    const token = await accessTokenAgenda(atual.usuario_id);
    const atualizado = await atualizarEventoAgenda(token, g[0].google_event_id, dados);
    meet = atualizado.meetLink ?? meet;
    link = atualizado.htmlLink ?? link;
  }
  await db.query(
    `UPDATE reunioes SET evento_id = $2, cliente_id = $3, titulo = $4, descricao = $5,
            inicio = $6::timestamp AT TIME ZONE '${FUSO}', fim = $7::timestamp AT TIME ZONE '${FUSO}',
            participantes = $8, local = $9, meet_link = $10, google_link = $11, updated_at = now()
      WHERE id = $1`,
    [id, evento?.id ?? null, evento?.cliente_id ?? null, input.titulo, input.descricao ?? null, dados.inicio, dados.fim, input.participantes,
     input.local ?? null, meet, link]
  );
  const r = await carregarReuniao(db, id);
  if (evento) {
    await registrarTimeline(db, { tenantId: user.tenantId, eventoId: evento.id, usuarioId: user.id }, 'reuniao', `Reunião atualizada: "${r.titulo}" em ${dataHoraCurta(r)}`, { reuniao_id: r.id });
  }
  return r;
}

/** Cancela: remove da agenda Google (avisando os participantes) e marca como cancelada. */
export async function cancelarReuniao(db: Db, user: SessionUser, id: string): Promise<Reuniao> {
  const atual = await carregarReuniao(db, id);
  if (!podeAlterar(user, atual)) throw new UserError('Só o organizador ou um administrador pode cancelar esta reunião.');
  if (atual.status === 'cancelada') return atual;
  const { rows } = await db.query<{ google_event_id: string | null }>('SELECT google_event_id FROM reunioes WHERE id = $1', [id]);
  if (rows[0]?.google_event_id && atual.usuario_id) {
    const token = await accessTokenAgenda(atual.usuario_id);
    await excluirEventoAgenda(token, rows[0].google_event_id);
  }
  await db.query(`UPDATE reunioes SET status = 'cancelada', updated_at = now() WHERE id = $1`, [id]);
  if (atual.evento_id) {
    await registrarTimeline(db, { tenantId: user.tenantId, eventoId: atual.evento_id, usuarioId: user.id }, 'reuniao', `Reunião cancelada: "${atual.titulo}" (${dataHoraCurta(atual)})`, { reuniao_id: id });
  }
  return carregarReuniao(db, id);
}

/** "21/12/2027 às 14:00" */
export function dataHoraCurta(r: Pick<Reuniao, 'data' | 'hora'>): string {
  const [a, m, d] = r.data.split('-');
  return `${d}/${m}/${a} às ${r.hora}`;
}

/** Eventos para o select da reunião: em aberto (não recusados), do mais próximo ao mais distante. */
export async function eventosParaReuniao(db: Db): Promise<{ id: string; rotulo: string }[]> {
  const { rows } = await db.query<{ id: string; titulo: string | null; cliente_nome: string | null; data_evento: string | null }>(
    `SELECT e.id, e.titulo, c.nome AS cliente_nome, to_char(e.data_evento, 'DD/MM/YYYY') AS data_evento
       FROM eventos e JOIN status_orcamento s ON s.id = e.status_id LEFT JOIN clientes c ON c.id = e.cliente_id
      WHERE s.variante <> 'recusado' AND (e.data_evento IS NULL OR e.data_evento >= current_date - 30)
      ORDER BY e.data_evento NULLS LAST, lower(e.titulo) LIMIT 300`
  );
  return rows.map((e) => ({ id: e.id, rotulo: [e.titulo ?? 'Evento', e.cliente_nome, e.data_evento].filter(Boolean).join(' · ') }));
}

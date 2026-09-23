// Agenda: eventos com data definida, por mês ou semana, coloridos pelo status do Kanban.
import type { Db } from '../lib/db';
import type { VarianteStatus } from './configuracoes';

export interface EventoAgenda {
  id: string;
  titulo: string | null;
  cliente_nome: string | null;
  data_evento: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  numero_convidados: number | null;
  local_nome: string | null;
  status_nome: string;
  cor: string;
  variante: VarianteStatus;
}

export const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ---------- Datas "YYYY-MM-DD" sem fuso (aritmética em UTC) ----------
const paraData = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const isoDe = (d: Date) => d.toISOString().slice(0, 10);
export const somarDias = (iso: string, dias: number) => isoDe(new Date(paraData(iso).getTime() + dias * 86_400_000));
export const diaDaSemana = (iso: string) => paraData(iso).getUTCDay();

/** Hoje no fuso de São Paulo */
export function hoje(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function dataValida(v: string | null | undefined): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(paraData(v).getTime()) ? v : null;
}

/** Semanas (domingo a sábado) que cobrem o mês da data informada */
export function gradeDoMes(referencia: string): { inicio: string; fim: string; semanas: string[][]; mes: number; ano: number } {
  const [ano, mes] = referencia.split('-').map(Number);
  const primeiro = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimo = isoDe(new Date(Date.UTC(ano, mes, 0)));
  const inicio = somarDias(primeiro, -diaDaSemana(primeiro));
  const fim = somarDias(ultimo, 6 - diaDaSemana(ultimo));
  const semanas: string[][] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 7)) semanas.push(Array.from({ length: 7 }, (_, i) => somarDias(d, i)));
  return { inicio, fim, semanas, mes, ano };
}

export function semanaDe(referencia: string): string[] {
  const inicio = somarDias(referencia, -diaDaSemana(referencia));
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
}

export async function eventosNoPeriodo(db: Db, inicio: string, fim: string, variante: string | null): Promise<EventoAgenda[]> {
  const { rows } = await db.query<EventoAgenda>(
    `SELECT e.id, e.titulo, c.nome AS cliente_nome, e.data_evento::text, to_char(e.hora_inicio, 'HH24:MI') AS hora_inicio,
            to_char(e.hora_fim, 'HH24:MI') AS hora_fim, e.numero_convidados, e.local_nome,
            s.nome AS status_nome, s.cor, s.variante
       FROM eventos e
       JOIN status_orcamento s ON s.id = e.status_id
       LEFT JOIN clientes c ON c.id = e.cliente_id
      WHERE e.data_evento BETWEEN $1 AND $2 AND ($3::text IS NULL OR s.variante = $3)
      ORDER BY e.data_evento, e.hora_inicio NULLS LAST, lower(e.titulo)`,
    [inicio, fim, variante]
  );
  return rows;
}

export function agruparPorDia(eventos: EventoAgenda[]): Map<string, EventoAgenda[]> {
  const mapa = new Map<string, EventoAgenda[]>();
  for (const e of eventos) mapa.set(e.data_evento, [...(mapa.get(e.data_evento) ?? []), e]);
  return mapa;
}

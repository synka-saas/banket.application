// Agendador mínimo do app (fase 1 do Banket Busca): um setInterval por processo para o que precisa acontecer sem
// requisição — rebaixamento dos testes vencidos (D+1 12h) e avisos D-7/D-1/D0 do trial. Idempotente: as duas cores
// do blue-green podem rodar ao mesmo tempo (dedup em plano_avisos e troca de plano com FOR UPDATE).
// Iniciado uma vez no módulo do middleware; o guard em globalThis segura o HMR do dev.
import { withSystem } from '../lib/db';
import { varrerTrials } from './planos';

const INTERVALO_MS = 10 * 60_000;
const PRIMEIRA_MS = 30_000;

async function tique(): Promise<void> {
  try {
    const r = await withSystem((db) => varrerTrials(db, new Date()));
    if (r.rebaixadas || r.avisos) console.log(`[agendador] trials: ${r.rebaixadas} rebaixada(s), ${r.avisos} aviso(s)`);
  } catch (err) {
    console.error('[agendador] varredura falhou:', err);
  }
}

export function iniciarAgendador(): void {
  const g = globalThis as unknown as { __banketAgendador?: ReturnType<typeof setInterval> };
  if (g.__banketAgendador || process.env.BANKET_SEM_AGENDADOR === '1') return;
  g.__banketAgendador = setInterval(tique, INTERVALO_MS);
  g.__banketAgendador.unref?.();
  setTimeout(tique, PRIMEIRA_MS).unref?.();
}

/** Para testes e scripts: roda uma varredura agora. */
export const varrerAgora = tique;

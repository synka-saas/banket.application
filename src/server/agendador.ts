// Agendador mínimo do app (fase 1 do Banket Busca): um setInterval por processo para o que precisa acontecer sem
// requisição — rebaixamento dos testes vencidos (D+1 12h), avisos D-7/D-1/D0 do trial e a cobrança da assinatura
// (fatura vencida, contratação Pix abandonada, reconciliação com o Stripe; server/assinatura.ts), a taxa de resposta dos
// perfis do Busca (a cada hora) e o aviso de prazo vencendo no WhatsApp (server/busca/respostas.ts). Idempotente: as
// duas cores do blue-green podem rodar ao mesmo tempo (dedup em plano_avisos e troca de plano com FOR UPDATE).
// Iniciado uma vez no módulo do middleware; o guard em globalThis segura o HMR do dev.
import { varrerCobranca } from './assinatura';
import { varrerTrials } from './planos';
import { atualizarRespostasBusca, avisarPrazosVencendo } from './busca/respostas';

const INTERVALO_MS = 10 * 60_000;
const PRIMEIRA_MS = 30_000;
const RESPOSTAS_MS = 60 * 60_000;
let ultimaTaxa = 0;

async function tique(): Promise<void> {
  try {
    const r = await varrerTrials(new Date());
    if (r.rebaixadas || r.avisos) console.log(`[agendador] trials: ${r.rebaixadas} rebaixada(s), ${r.avisos} aviso(s)`);
  } catch (err) {
    console.error('[agendador] varredura falhou:', err);
  }
  try {
    const c = await varrerCobranca(new Date());
    if (c.rebaixadas || c.abandonadas) console.log(`[agendador] cobrança: ${c.rebaixadas} rebaixada(s), ${c.abandonadas} contratação(ões) Pix abandonada(s)`);
  } catch (err) {
    console.error('[agendador] cobrança falhou:', err);
  }
  if (Date.now() - ultimaTaxa >= RESPOSTAS_MS) {
    try {
      await atualizarRespostasBusca();
      ultimaTaxa = Date.now();
    } catch (err) {
      console.error('[agendador] taxa de resposta falhou:', err);
    }
  }
  try {
    const n = await avisarPrazosVencendo();
    if (n) console.log(`[agendador] whatsapp: ${n} aviso(s) de prazo`);
  } catch (err) {
    console.error('[agendador] aviso de prazo falhou:', err);
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

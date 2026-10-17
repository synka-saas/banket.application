// Feature gating centralizado (fase 1 do Banket Busca). FONTE ÚNICA = banco: fn_tenant_entitlements(uuid)
// (migration 031) junta o plano da empresa com o override do Manager Hwesta. Este módulo só lê a função,
// guarda 15 s por empresa e aplica: módulos (`podeUsar`), limites (`limite`/`dentroDoLimite`) e o recorte de
// histórico. Toda transição de plano (server/planos.ts) chama `invalidar`.
// Regra herdada: empresa SEM plano (sem_plano) é permissiva — nenhum gate, nenhum limite.
import { systemQuery, type Db } from '../db';
import type { Modulo } from './recursos';

export interface Entitlements {
  tenantId: string;
  semPlano: boolean;
  planoId: string | null;
  planoSlug: string | null;
  planoNome: string | null;
  gratuito: boolean;
  /** Plano do catálogo público (false = interno: Busca, Completo) */
  publico: boolean;
  /** Teste em andamento (plano pago com trial_ate ≥ hoje) */
  trial: { ate: string; diasRestantes: number } | null;
  /** Plano pago com trial_ate no passado: o agendador (ou o middleware) rebaixa para o plano Busca */
  trialVencido: boolean;
  trialAte: string | null;
  trialUsado: boolean;
  trialRecusadoEm: string | null;
  /** Por onde a empresa entrou: site (gestão), busca (vitrine) ou importacao */
  origemCadastro: string | null;
  /** Assinatura do Stripe existente (em dia, em teste no Stripe ou com fatura pendente) */
  assinaturaViva: boolean;
  /** Plano escolhido no checkout, à espera da confirmação do Stripe */
  planoPendenteId: string | null;
  recursos: Record<string, boolean | number>;
}

const TTL_MS = 15_000;
const cache = new Map<string, { value: Entitlements | null; expires: number }>();

function converter(e: any): Entitlements | null {
  if (!e) return null;
  return {
    tenantId: e.tenant_id,
    semPlano: Boolean(e.sem_plano),
    planoId: e.plano_id ?? null,
    planoSlug: e.plano_slug ?? null,
    planoNome: e.plano_nome ?? null,
    gratuito: Boolean(e.gratuito),
    publico: Boolean(e.publico),
    trial: e.trial ? { ate: String(e.trial.ate), diasRestantes: Number(e.trial.dias_restantes) } : null,
    trialVencido: Boolean(e.trial_vencido),
    trialAte: e.trial_ate ? String(e.trial_ate) : null,
    trialUsado: Boolean(e.trial_usado),
    trialRecusadoEm: e.trial_recusado_em ? String(e.trial_recusado_em) : null,
    origemCadastro: e.origem_cadastro ?? null,
    assinaturaViva: Boolean(e.assinatura_viva),
    planoPendenteId: e.plano_pendente_id ?? null,
    recursos: (e.recursos ?? {}) as Record<string, boolean | number>,
  };
}

/** Entitlements da empresa (cache de 15 s). `db` opcional para ler na própria transação (ex.: logo após uma troca). */
export async function entitlements(tenantId: string, db?: Db): Promise<Entitlements | null> {
  if (!db) {
    const hit = cache.get(tenantId);
    if (hit && hit.expires > Date.now()) return hit.value;
  }
  const sql = 'SELECT fn_tenant_entitlements($1) AS e';
  const { rows } = db ? await db.query<{ e: any }>(sql, [tenantId]) : await systemQuery<{ e: any }>(sql, [tenantId]);
  const value = converter(rows[0]?.e);
  cache.set(tenantId, { value, expires: Date.now() + TTL_MS });
  return value;
}

export function invalidar(tenantId: string): void {
  cache.delete(tenantId);
}

// ---------- regras puras sobre um Entitlements já carregado (testáveis sem banco) ----------

/** Booleano de módulo/recurso. Sem plano → true; recurso ausente → false. */
export function podeUsarEm(ent: Entitlements | null, recurso: string): boolean {
  if (!ent || ent.semPlano) return true;
  const v = ent.recursos[recurso];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return false;
}

/** Limite numérico. Sem plano, recurso ausente ou -1 → Infinity. */
export function limiteEm(ent: Entitlements | null, recurso: string): number {
  if (!ent || ent.semPlano) return Number.POSITIVE_INFINITY;
  const v = ent.recursos[recurso];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return Number.POSITIVE_INFINITY;
  return v;
}

/** Empresa cliente (plano pago, em teste ou ativo) ou gratuita. Sem plano conta como cliente. */
export const nivelEm = (ent: Entitlements | null): 'gratuito' | 'cliente' => (ent?.gratuito ? 'gratuito' : 'cliente');

// ---------- atalhos com banco ----------

export async function podeUsar(tenantId: string, recurso: Modulo | string): Promise<boolean> {
  return podeUsarEm(await entitlements(tenantId), recurso);
}

export async function limite(tenantId: string, recurso: string): Promise<number> {
  return limiteEm(await entitlements(tenantId), recurso);
}

export async function dentroDoLimite(tenantId: string, recurso: string, usoAtual: number): Promise<boolean> {
  return usoAtual < (await limite(tenantId, recurso));
}

/** Data (ISO "YYYY-MM-DD") a partir da qual o histórico é visível, ou null sem recorte. */
export async function recorteHistorico(tenantId: string): Promise<string | null> {
  const meses = await limite(tenantId, 'historico_meses');
  if (!Number.isFinite(meses)) return null;
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d.toISOString().slice(0, 10);
}

// ---------- erros padronizados ----------

export type CodigoErroPlano = 'RECURSO_FORA_DO_PLANO' | 'LIMITE_DO_PLANO' | 'TRIAL_INDISPONIVEL';
export const UPGRADE_URL = '/planos';

/** Erro de plano: vira 403 JSON { code, recurso, limite, uso, upgrade_url } nos endpoints e mensagem nas páginas. */
export class ErroPlano extends Error {
  constructor(
    public readonly code: CodigoErroPlano,
    public readonly recurso: string,
    message: string,
    public readonly limite?: number,
    public readonly uso?: number
  ) {
    super(message);
    this.name = 'ErroPlano';
  }
  toJSON() {
    return { error: this.message, code: this.code, recurso: this.recurso, limite: this.limite, uso: this.uso, upgrade_url: UPGRADE_URL };
  }
}

/** Lança se o recurso não faz parte do plano. */
export async function exigir(tenantId: string, recurso: Modulo | string, rotulo?: string): Promise<void> {
  if (!(await podeUsar(tenantId, recurso))) {
    throw new ErroPlano('RECURSO_FORA_DO_PLANO', recurso, `${rotulo ?? 'Este recurso'} não faz parte do seu plano.`);
  }
}

/** Lança se criar mais um item estoura o limite. `contar` devolve o uso atual (só é chamado se há limite). */
export async function exigirLimite(tenantId: string, recurso: string, contar: () => Promise<number>, rotulo = 'itens'): Promise<void> {
  const max = await limite(tenantId, recurso);
  if (!Number.isFinite(max)) return;
  const uso = await contar();
  if (uso >= max) {
    throw new ErroPlano('LIMITE_DO_PLANO', recurso, `O seu plano permite até ${max} ${rotulo}. Para criar mais, mude de plano.`, max, uso);
  }
}

/** Mesma checagem dentro de uma transação com tenant (lê o tenant de app.current_tenant_id). */
export async function exigirLimiteDb(db: Db, recurso: string, sqlContagem: string, rotulo = 'itens'): Promise<void> {
  const { rows } = await db.query<{ t: string | null }>(`SELECT app_tenant_id()::text AS t`);
  const tenantId = rows[0]?.t;
  if (!tenantId) return;
  await exigirLimite(tenantId, recurso, async () => Number((await db.query<{ n: number }>(sqlContagem)).rows[0]?.n ?? 0), rotulo);
}

/** Uso atual em listagens ("4 de 5"): null quando não há limite. */
export async function usoDoLimite(db: Db, tenantId: string, recurso: string, sqlContagem: string): Promise<{ uso: number; limite: number } | null> {
  const max = await limite(tenantId, recurso);
  if (!Number.isFinite(max)) return null;
  const { rows } = await db.query<{ n: number }>(sqlContagem);
  return { uso: Number(rows[0]?.n ?? 0), limite: max };
}

import pg from 'pg';

// numeric → number (valores monetários cabem com folga em double para o domínio do app)
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
// int8 (count(*)) → number
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));

function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

// Limites de todas as conexões: esperar uma conexão livre por até 10 s (pool cheio responde erro em vez de pendurar a
// requisição), consulta de até 30 s e transação parada de até 2 min (cobre a espera pelo Chromium ou pela OpenAI).
const LIMITES = { connectionTimeoutMillis: 10_000, statement_timeout: 30_000, idle_in_transaction_session_timeout: 120_000 };

function criarPool(nome: string, config: pg.PoolConfig): pg.Pool {
  const pool = new pg.Pool({ ...LIMITES, ...config });
  // Conexão ociosa que cai (restart do Postgres, rede) emite 'error' no pool: sem este ouvinte o processo inteiro cai
  pool.on('error', (err) => console.error(`[db] conexão do pool ${nome} caiu:`, err.message));
  return pool;
}

// Papel da aplicação: sem superuser, sujeito ao RLS. Toda query de domínio passa por withTenant().
const appPool = criarPool('app', { connectionString: env('DATABASE_URL'), max: 10 });

// Dono das tabelas: ignora RLS. Uso restrito a fluxos sem tenant definido
// (login, cadastro, convites, recuperação de senha, formulário público).
const systemPool = criarPool('sistema', {
  connectionString: env('DATABASE_URL_SYSTEM') ?? env('DATABASE_URL'),
  max: 3,
});

// Leituras públicas da vitrine (Banket Busca): mesma credencial de sistema, pool separado para o tráfego público e de
// robôs não disputar as 3 conexões de login/cadastro. Só server/busca/publico.ts usa, sempre em transação READ ONLY.
const publicPool = criarPool('vitrine', {
  connectionString: env('DATABASE_URL_SYSTEM') ?? env('DATABASE_URL'),
  max: Number(env('DB_POOL_VITRINE') ?? 6),
});

// Contadores da vitrine (aparições, visualizações, cliques): gravação pública e frequente, num pool próprio e pequeno
// para nunca ocupar as conexões de login/cadastro (systemPool) nem as leituras da vitrine.
const metricasPool = criarPool('metricas', {
  connectionString: env('DATABASE_URL_SYSTEM') ?? env('DATABASE_URL'),
  max: 2,
  statement_timeout: 5_000,
});

export type Db = pg.PoolClient;

async function transaction<T>(pool: pg.Pool, fn: (db: Db) => Promise<T>, tenantId?: string): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (tenantId) {
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Executa `fn` numa transação isolada pelo RLS no tenant informado. */
export function withTenant<T>(tenantId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  if (!tenantId) throw new Error('withTenant: tenantId obrigatório');
  return transaction(appPool, fn, tenantId);
}

/** Atalho para uma única query isolada pelo tenant. */
export async function tenantQuery<R extends pg.QueryResultRow = any>(
  tenantId: string,
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<R>> {
  return withTenant(tenantId, (db) => db.query<R>(text, params));
}

/** Transação com a conexão de sistema (sem RLS). Use só em fluxos sem tenant. */
export function withSystem<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return transaction(systemPool, fn);
}

export async function systemQuery<R extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<R>> {
  return systemPool.query<R>(text, params);
}

/** Transação somente leitura no pool da vitrine (sem RLS: o chamador filtra o que é público). */
export function withLeituraPublica<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return transaction(publicPool, async (db) => {
    await db.query('SET TRANSACTION READ ONLY');
    // Página pública: consulta lenta (robô, busca ampla) é cortada antes de prender o pool
    await db.query(`SET LOCAL statement_timeout = '5s'`);
    return fn(db);
  });
}

/**
 * Grava um contador da vitrine sem esperar (a página nunca depende dele). Com o pool de métricas ocupado e fila
 * grande, descarta: perder uma contagem é melhor que acumular conexões sob robôs.
 */
export function gravarMetrica(text: string, params: unknown[]): void {
  if (metricasPool.waitingCount > 50) return;
  metricasPool.query(text, params).catch((err) => console.error('[busca] métrica:', err.message));
}

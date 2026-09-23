// Aplica db/migrations/*.sql em ordem (uma transação por arquivo) e garante o papel
// da aplicação (sem superuser/bypassrls) com os GRANTs necessários.
//
// Uso: node scripts/migrate.mjs [--seed]
//   --seed  também aplica db/seeds/*.sql (arquivos que começam com "_" são ignorados)
//
// Variáveis:
//   DATABASE_URL_SYSTEM  conexão do dono das tabelas (executa as migrations)
//   APP_DB_USER / APP_DB_PASSWORD  papel usado pela aplicação (DATABASE_URL)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const connectionString = process.env.DATABASE_URL_SYSTEM;
const appUser = process.env.APP_DB_USER || 'banket_app';
const appPassword = process.env.APP_DB_PASSWORD;
const withSeeds = process.argv.includes('--seed');

if (!connectionString) {
  console.error('[migrate] DATABASE_URL_SYSTEM não definida.');
  process.exit(1);
}
if (!/^[a-z_][a-z0-9_]*$/.test(appUser)) {
  console.error(`[migrate] APP_DB_USER inválido: ${appUser}`);
  process.exit(1);
}

const client = new pg.Client({ connectionString });

function sqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('_'))
    .sort();
}

async function applyDir(dir, table) {
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${table} (version TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT now())`
  );
  const { rows } = await client.query(`SELECT version FROM ${table}`);
  const applied = new Set(rows.map((r) => r.version));

  // Banco criado antes do sistema de migrations: o schema base já existe.
  if (table === 'schema_migrations' && applied.size === 0) {
    const { rows: [r] } = await client.query(`SELECT to_regclass('public.tenants') AS t`);
    if (r.t) {
      await client.query(`INSERT INTO schema_migrations (version) VALUES ('000_baseline')`);
      applied.add('000_baseline');
      console.log('[migrate] banco existente detectado: baseline marcada como aplicada');
    }
  }
  if (table === 'schema_seeds' && applied.size === 0) {
    const { rows: [r] } = await client.query(`SELECT count(*)::int AS n FROM tenants WHERE slug = 'banket'`);
    if (r.n > 0) {
      await client.query(`INSERT INTO schema_seeds (version) VALUES ('001_tenant_usuarios')`);
      applied.add('001_tenant_usuarios');
      console.log('[migrate] seed inicial já presente: marcada como aplicada');
    }
  }

  for (const file of sqlFiles(dir)) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO ${table} (version) VALUES ($1)`, [version]);
      await client.query('COMMIT');
      console.log(`[migrate] aplicado ${path.basename(dir)}/${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] falha em ${file}:`, err.message);
      throw err;
    }
  }
}

async function ensureAppRole() {
  if (!appPassword) {
    console.warn('[migrate] APP_DB_PASSWORD não definida: papel da aplicação não foi criado/atualizado.');
    return;
  }
  const { rows } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appUser]);
  const stmt = rows.length ? 'ALTER ROLE %I LOGIN PASSWORD %L' : 'CREATE ROLE %I LOGIN PASSWORD %L';
  const { rows: [{ sql }] } = await client.query(`SELECT format('${stmt}', $1::text, $2::text) AS sql`, [appUser, appPassword]);
  await client.query(sql);
  const { rows: [{ db }] } = await client.query('SELECT current_database() AS db');
  const q = (s) => client.query(s.replaceAll('$APP', `"${appUser}"`).replaceAll('$DB', `"${db}"`));
  await q('ALTER ROLE $APP NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE');
  await q('GRANT CONNECT ON DATABASE $DB TO $APP');
  await q('GRANT USAGE ON SCHEMA public TO $APP');
  await q('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $APP');
  await q('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $APP');
  await q('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO $APP');
  await q('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $APP');
  await q('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $APP');
  await q('REVOKE ALL ON schema_migrations FROM $APP');
  if (withSeeds) await q('REVOKE ALL ON schema_seeds FROM $APP');
  console.log(`[migrate] papel da aplicação "${appUser}" pronto`);
}

try {
  await client.connect();
  await applyDir(path.join(root, 'db/migrations'), 'schema_migrations');
  if (withSeeds) await applyDir(path.join(root, 'db/seeds'), 'schema_seeds');
  await ensureAppRole();
  console.log('[migrate] ok');
} catch {
  process.exitCode = 1;
} finally {
  await client.end();
}

// help-auth — verificação de sessão da Central de Ajuda (platform.yosp.app/ajuda/).
//
// Chamado pelo nginx do container da ajuda via `auth_request` a cada requisição
// protegida. Responde só 200 (sessão válida) ou 401, sem corpo. (200 e não 204:
// o nginx guarda a resposta positiva em cache por 30 s por token.)
//
// Mesma regra de acesso de leitura do painel (platform/src/middleware.js), sem
// tocar no código da plataforma:
//   - cookie `auth_token` (JWT HS256 assinado com o JWT_SECRET compartilhado);
//   - papel entre account_owner, administrator, hoster, property_owner;
//   - conta não desativada (accounts.is_active = false derruba a sessão no painel).
//     Conta pausada/suspensa por cobrança continua lendo no painel, então lê a ajuda também.
// A renovação do token (refresh) fica com a plataforma: a tela de login da ajuda
// chama POST /api/auth/refresh no mesmo host quando o access token expira.
import http from 'node:http';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const VALID_ROLES = new Set(['account_owner', 'administrator', 'hoster', 'property_owner']);
const ACCOUNT_TTL_MS = 30_000; // mesmo TTL do cache de cobrança do painel

if (!JWT_SECRET) {
  console.error('[help-auth] JWT_SECRET ausente; encerrando.');
  process.exit(1);
}

// Usuário de aplicação (respeita RLS): lê só a própria conta via app.account_id.
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'yosp_db',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  max: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,
});
pool.on('error', (err) => console.error('[help-auth] erro no pool:', err.message));

const accountCache = new Map(); // accountId → { active, at }

async function accountIsActive(accountId) {
  const hit = accountCache.get(accountId);
  if (hit && Date.now() - hit.at < ACCOUNT_TTL_MS) return hit.active;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.account_id', $1, true)", [accountId]);
    const { rows } = await client.query('SELECT is_active FROM accounts WHERE id = $1', [accountId]);
    await client.query('COMMIT');
    const active = rows[0] ? rows[0].is_active !== false : false;
    accountCache.set(accountId, { active, at: Date.now() });
    return active;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function isAuthorized(req) {
  const token = readCookie(req.headers.cookie, 'auth_token');
  if (!token) return false;
  let user;
  try {
    user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return false; // expirado ou inválido: a tela de login tenta o refresh
  }
  // Tokens de outros apps (prestador: {sub}; api: role=superadmin; estados de MFA/ativação) não valem aqui.
  if (!user || user.scope || user.purpose || !VALID_ROLES.has(user.role) || !user.id) return false;
  if (!user.account_id || !UUID_RE.test(user.account_id)) return false;
  try {
    return await accountIsActive(user.account_id);
  } catch (err) {
    // Banco fora: a plataforma também estaria fora; não bloqueia quem já tem token válido.
    console.error('[help-auth] falha ao consultar a conta:', err.message);
    return true;
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  if (url === '/check' || url.startsWith('/check?')) {
    const ok = await isAuthorized(req).catch(() => false);
    res.writeHead(ok ? 200 : 401, { 'Content-Length': '0' });
    return res.end();
  }
  res.writeHead(404);
  res.end();
});

server.keepAliveTimeout = 65_000;
server.listen(PORT, '0.0.0.0', () => console.log(`[help-auth] ouvindo na porta ${PORT}`));

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => pool.end().finally(() => process.exit(0))));
}

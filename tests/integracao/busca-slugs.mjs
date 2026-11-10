// DATABASE_URL_SYSTEM=… node tests/integracao/busca-slugs.mjs
// Confere a migration e as colisões num banco com ao menos dois perfis. Sempre desfaz tudo.
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

if (!process.env.DATABASE_URL_SYSTEM) throw new Error('Defina DATABASE_URL_SYSTEM para o banco de teste.');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL_SYSTEM });
await db.connect();
try {
  await db.query('BEGIN');
  const { rows: [funcao] } = await db.query("SELECT to_regprocedure('busca_garantir_slug_publico()') AS existe");
  if (!funcao.existe) await db.query(readFileSync(new URL('../../db/migrations/053_busca_slugs_publicos.sql', import.meta.url), 'utf8'));
  const { rows: [contagem] } = await db.query('SELECT count(*) AS total, count(DISTINCT slug) AS unicos, count(*) FILTER (WHERE slug=id::text) AS uuid FROM busca_perfis');
  assert.equal(contagem.uuid, '0');
  assert.equal(contagem.total, contagem.unicos);
  const { rows: perfis } = await db.query('SELECT id FROM busca_perfis ORDER BY id LIMIT 2');
  assert.equal(perfis.length, 2, 'O banco de teste precisa ter ao menos dois perfis.');
  const nome = `Buffet teste ${Date.now()}`;
  const slugs = [];
  for (const p of perfis) {
    const { rows: [atual] } = await db.query("UPDATE busca_perfis SET nome=$2, slug='' WHERE id=$1 RETURNING slug", [p.id, nome]);
    slugs.push(atual.slug);
  }
  assert.equal(slugs[1], `${slugs[0]}-2`);
  const id = perfis[0].id;
  for (let n = 0; n < 5; n++) await db.query('UPDATE busca_perfis SET slug=$2 WHERE id=$1', [id, `${slugs[0]}-escolhido-${n}`]);
  await db.query('UPDATE busca_perfis SET nome=$2, slug=id::text WHERE id=$1', [id, 'Nome alterado']);
  const { rows: [atual] } = await db.query('SELECT slug,slugs_antigos FROM busca_perfis WHERE id=$1', [id]);
  assert.equal(atual.slug, `${slugs[0]}-escolhido-4`, 'Downgrade não deve devolver a URL ao UUID.');
  assert(atual.slugs_antigos.includes(slugs[0]));
  assert(atual.slugs_antigos.includes(`${slugs[0]}-escolhido-0`), 'Histórico não pode expirar após três trocas.');
  await db.query('SAVEPOINT colisao');
  await assert.rejects(db.query('UPDATE busca_perfis SET slug=$2 WHERE id=$1', [perfis[1].id, slugs[0]]), { code: '23505' });
  await db.query('ROLLBACK TO SAVEPOINT colisao');
  console.log(`Slugs validados: ${contagem.total} perfis únicos; colisões, histórico e downgrade aprovados.`);
} finally {
  await db.query('ROLLBACK');
  await db.end();
}

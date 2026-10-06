// Modelos de e-mail da empresa (Configurações › Modelos de e-mail): assunto e corpo com variáveis, escolhidos
// no envio da proposta e ao responder no Inbox. Um deles é o padrão (pré-selecionado).
import { z } from 'zod';
import type { Db } from '../lib/db';
import { UserError, checkbox, requiredText } from '../lib/forms';
import { aplicarVariaveis } from '../lib/documentos/variaveis';

/** Variáveis aceitas nos modelos de e-mail. */
export const VARIAVEIS_EMAIL = ['{nome_cliente}', '{evento}', '{data_evento}', '{empresa}', '{valor_total}', '{versao}'];

export const emailModeloSchema = z.object({
  nome: requiredText('Informe o nome do modelo.', 120),
  assunto: requiredText('Informe o assunto.', 255),
  corpo: requiredText('Escreva a mensagem.', 10_000),
  padrao: checkbox(),
  ativo: checkbox(),
});

export type EmailModeloInput = z.infer<typeof emailModeloSchema>;

export interface EmailModelo {
  id: string;
  nome: string;
  assunto: string;
  corpo: string;
  padrao: boolean;
  ativo: boolean;
  ordem: number;
}

const ORDEM = 'padrao DESC, ativo DESC, ordem, lower(nome)';

export async function listarEmailModelos(db: Db, opts: { somenteAtivos?: boolean } = {}): Promise<EmailModelo[]> {
  const { rows } = await db.query<EmailModelo>(
    `SELECT id, nome, assunto, corpo, padrao, ativo, ordem FROM email_modelos ${opts.somenteAtivos ? 'WHERE ativo' : ''} ORDER BY ${ORDEM}`
  );
  return rows;
}

export async function salvarEmailModelo(db: Db, tenantId: string, id: string | null, input: EmailModeloInput): Promise<string> {
  const { rows: existentes } = await db.query<{ n: number }>(
    'SELECT count(*) AS n FROM email_modelos WHERE $1::uuid IS NULL OR id <> $1',
    [id]
  );
  // O primeiro modelo da empresa é o padrão; o padrão não pode ficar inativo
  const padrao = input.padrao || existentes[0].n === 0;
  const ativo = padrao ? true : input.ativo;
  if (input.padrao && !input.ativo) throw new UserError('O modelo padrão precisa estar ativo.', 'ativo');
  if (padrao) await db.query('UPDATE email_modelos SET padrao = false WHERE padrao AND ($1::uuid IS NULL OR id <> $1)', [id]);

  if (id) {
    const res = await db.query(
      `UPDATE email_modelos SET nome = $1, assunto = $2, corpo = $3, padrao = $4, ativo = $5, updated_at = now() WHERE id = $6`,
      [input.nome, input.assunto, input.corpo, padrao, ativo, id]
    );
    if (!res.rowCount) throw new UserError('Modelo não encontrado.');
    await garantirPadrao(db);
    return id;
  }
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO email_modelos (nome, assunto, corpo, padrao, ativo, tenant_id,
                                ordem)
     VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(max(ordem), 0) + 1 FROM email_modelos)) RETURNING id`,
    [input.nome, input.assunto, input.corpo, padrao, ativo, tenantId]
  );
  return rows[0].id;
}

/** Sem padrão (o antigo foi desmarcado ou excluído), o primeiro modelo ativo assume. */
async function garantirPadrao(db: Db) {
  await db.query(
    `UPDATE email_modelos SET padrao = true
      WHERE NOT EXISTS (SELECT 1 FROM email_modelos WHERE padrao)
        AND id = (SELECT id FROM email_modelos WHERE ativo ORDER BY ordem, lower(nome) LIMIT 1)`
  );
}

export async function definirEmailModeloPadrao(db: Db, id: string): Promise<void> {
  const { rows } = await db.query<{ ativo: boolean }>('SELECT ativo FROM email_modelos WHERE id = $1', [id]);
  if (!rows[0]) throw new UserError('Modelo não encontrado.');
  if (!rows[0].ativo) throw new UserError('Ative o modelo antes de defini-lo como padrão.');
  await db.query('UPDATE email_modelos SET padrao = false WHERE padrao');
  await db.query('UPDATE email_modelos SET padrao = true, updated_at = now() WHERE id = $1', [id]);
}

export async function excluirEmailModelo(db: Db, id: string): Promise<void> {
  const { rows } = await db.query<{ n: number }>('SELECT count(*) AS n FROM email_modelos');
  if (rows[0].n <= 1) throw new UserError('Mantenha pelo menos um modelo de e-mail.');
  const res = await db.query('DELETE FROM email_modelos WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Modelo não encontrado.');
  await garantirPadrao(db);
}

export { aplicarVariaveis };

export interface ModeloPronto {
  id: string;
  nome: string;
  assunto: string;
  corpo: string;
  padrao: boolean;
}

/** Modelos ativos com as variáveis já aplicadas (para os selects de envio e de resposta). */
export async function modelosComVariaveis(db: Db, valores: Record<string, string>): Promise<ModeloPronto[]> {
  const modelos = await listarEmailModelos(db, { somenteAtivos: true });
  return modelos.map((m) => ({
    id: m.id,
    nome: m.nome,
    assunto: aplicarVariaveis(m.assunto, valores),
    corpo: aplicarVariaveis(m.corpo, valores),
    padrao: m.padrao,
  }));
}

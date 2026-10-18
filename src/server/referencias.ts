// Conferência de ids vindos do navegador antes de gravá-los em chaves estrangeiras: a FK não passa pelo RLS, então um
// id de outra empresa seria aceito pelo banco. Dentro de withTenant, o SELECT só enxerga as linhas da empresa.
import type { Db } from '../lib/db';
import { UserError } from '../lib/forms';

type Tabela = 'catalogo_secoes' | 'categorias_item' | 'formatos_servico' | 'staff_servicos';

/** Cada [tabela, id, mensagem] com id preenchido precisa existir na empresa da transação. */
export async function conferirReferencias(db: Db, refs: [Tabela, string | null | undefined, string][]): Promise<void> {
  for (const [tabela, id, mensagem] of refs) {
    if (!id) continue;
    const { rowCount } = await db.query(`SELECT 1 FROM ${tabela} WHERE id = $1`, [id]);
    if (!rowCount) throw new UserError(mensagem);
  }
}

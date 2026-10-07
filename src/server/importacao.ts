// Importação por CSV (UX-053): clientes e itens do cardápio. Cada linha é validada com os mesmos
// schemas do cadastro manual; as válidas são gravadas e as inválidas voltam com o motivo, linha a linha.
import type { Db } from '../lib/db';
import { csvComCabecalho } from '../lib/csv';
import { UserError, userMessage } from '../lib/forms';
import { clienteSchema, salvarCliente } from './clientes';
import { itemSchema, salvarItem } from './cardapio';

export interface ResultadoImportacao {
  importados: number;
  total: number;
  erros: { linha: number; motivo: string }[];
}

export const MODELO_CLIENTES = [
  'nome;tipo_pessoa;documento;email;telefone;endereco;observacoes',
  'Maria Souza;PF;529.982.247-25;maria@email.com;(11) 98888-7777;Rua das Flores, 10 - São Paulo - SP;Indicada pela Ana',
  'TechCorp Brasil;PJ;11.222.333/0001-81;compras@techcorp.com.br;(11) 3333-4444;Av. Paulista, 1000 - São Paulo - SP;',
].join('\r\n');

export const MODELO_ITENS = [
  'secao;nome;descricao;preco;unidade_cobranca;porcao;porcao_unidade;composicao',
  'Coquetel;Bruschetta de tomate;Tomate confitado com manjericão;9,50;pessoa;80;g;',
  'Soft drinks;Pink lemonade;;12,00;unidade;300;ml;Limão siciliano, framboesa e hortelã',
].join('\r\n');

const LIMITE_LINHAS = 500;

function conferirLimite(totalLinhas: number) {
  if (totalLinhas === 0) throw new UserError('O arquivo não tem linhas de dados. Baixe o modelo e preencha uma linha por registro.');
  if (totalLinhas > LIMITE_LINHAS) throw new UserError(`O arquivo tem ${totalLinhas} linhas; o limite por importação é ${LIMITE_LINHAS}.`);
}

export async function importarClientes(db: Db, tenantId: string, csv: string): Promise<ResultadoImportacao> {
  const { linhas, colunas } = csvComCabecalho(csv);
  if (!colunas.includes('nome')) throw new UserError('O cabeçalho precisa ter a coluna "nome". Baixe o modelo para conferir as colunas.');
  conferirLimite(linhas.length);

  const resultado: ResultadoImportacao = { importados: 0, total: linhas.length, erros: [] };
  for (const { numero, valores } of linhas) {
    try {
      const input = clienteSchema.parse({
        nome: valores.nome,
        tipo_pessoa: (valores.tipo_pessoa || 'PF').toUpperCase(),
        documento: valores.documento || null,
        email: valores.email || null,
        telefone: valores.telefone || null,
        endereco: valores.endereco || null,
        observacoes: valores.observacoes || null,
      });
      await salvarCliente(db, tenantId, null, input);
      resultado.importados++;
    } catch (err) {
      resultado.erros.push({ linha: numero, motivo: userMessage(err) });
    }
  }
  return resultado;
}

export async function importarItens(db: Db, tenantId: string, csv: string): Promise<ResultadoImportacao> {
  const { linhas, colunas } = csvComCabecalho(csv);
  if (!colunas.includes('secao') || !colunas.includes('nome')) {
    throw new UserError('O cabeçalho precisa ter as colunas "secao" e "nome". Baixe o modelo para conferir as colunas.');
  }
  conferirLimite(linhas.length);

  // Seções pelo nome (sem diferenciar maiúsculas); as que faltarem são criadas
  const { rows } = await db.query<{ id: string; nome: string }>('SELECT id, nome FROM catalogo_secoes');
  const secoes = new Map(rows.map((r) => [r.nome.trim().toLowerCase(), r.id]));
  const secaoDaLinha = async (nome: string): Promise<string> => {
    const chave = nome.trim().toLowerCase();
    const existente = secoes.get(chave);
    if (existente) return existente;
    const nova = await db.query<{ id: string }>(
      `INSERT INTO catalogo_secoes (tenant_id, nome, ordem)
       VALUES ($1, $2, (SELECT COALESCE(max(ordem), 0) + 1 FROM catalogo_secoes))
       RETURNING id`,
      [tenantId, nome.trim().slice(0, 120)]
    );
    secoes.set(chave, nova.rows[0].id);
    return nova.rows[0].id;
  };

  const resultado: ResultadoImportacao = { importados: 0, total: linhas.length, erros: [] };
  for (const { numero, valores } of linhas) {
    try {
      if (!valores.secao) throw new UserError('Informe a seção do item.');
      const secaoId = await secaoDaLinha(valores.secao);
      const input = itemSchema.parse({
        nome: valores.nome,
        secao_id: secaoId,
        descricao: valores.descricao || null,
        composicao: valores.composicao || null,
        preco: valores.preco || null,
        custo_unitario: valores.custo_unitario || null,
        unidade_cobranca: (valores.unidade_cobranca || 'pessoa').toLowerCase(),
        porcao_qtd: valores.porcao || null,
        porcao_unidade: (valores.porcao_unidade || '').toLowerCase() || null,
        restricoes: [],
        dados_operacionais: [],
        ativo: 'on',
      });
      await salvarItem(db, tenantId, null, input);
      resultado.importados++;
    } catch (err) {
      resultado.erros.push({ linha: numero, motivo: userMessage(err) });
    }
  }
  return resultado;
}

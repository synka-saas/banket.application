// Formulários públicos de captação: configuração (a partir do modelo), página pública e respostas.
import { z } from 'zod';
import { systemQuery, withTenant, type Db } from '../lib/db';
import { UserError, optionalText, requiredText } from '../lib/forms';
import type { PageParams } from '../lib/pagination';
import {
  configSchema,
  extrairConfig,
  montarFormulario,
  resumirRespostas,
  rotuloOpcao,
  validarRespostas,
  type RespostaResumo,
  type Respostas,
  type SecaoResolvida,
} from '../lib/formularios/modelo';
import { clienteSchema, salvarCliente } from './clientes';
import { criarEvento, eventoSchema } from './eventos';

// ---------------------------------------------------------------------------
// Administração
// ---------------------------------------------------------------------------
const slugify = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'formulario';

const sufixo = () => Math.random().toString(16).slice(2, 8);

export const formularioSchema = z.object({
  nome: requiredText('Informe o nome do formulário.', 120),
  descricao: optionalText(1000),
  slug: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z
      .string({ error: 'Informe o endereço do formulário.' })
      .min(3, 'O endereço precisa ter ao menos 3 caracteres.')
      .max(80, 'O endereço pode ter no máximo 80 caracteres.')
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use só letras minúsculas, números e hífens no endereço.')
  ),
  ativo: z.boolean(),
  mensagem_sucesso: optionalText(1000),
  config: configSchema,
});

export type FormularioInput = z.infer<typeof formularioSchema>;

export interface FormularioResumo {
  id: string;
  nome: string;
  descricao: string | null;
  slug: string;
  ativo: boolean;
  secoes_ativas: number;
  perguntas_ativas: number;
  respostas: number;
  ultima_resposta: Date | null;
}

export async function listarFormularios(db: Db, busca: string | null): Promise<FormularioResumo[]> {
  const { rows } = await db.query(
    `SELECT f.id, f.nome, f.descricao, f.slug, f.ativo, f.config,
            count(r.id)::int AS respostas, max(r.created_at) AS ultima_resposta
       FROM formularios f
       LEFT JOIN formulario_respostas r ON r.formulario_id = f.id
      WHERE ($1::text IS NULL OR f.nome ILIKE $1 OR f.slug ILIKE $1)
      GROUP BY f.id
      ORDER BY f.created_at`,
    [busca]
  );
  return rows.map(({ config, ...f }) => {
    const secoes = montarFormulario(config).filter((s) => s.ativa);
    return {
      ...f,
      secoes_ativas: secoes.length,
      perguntas_ativas: secoes.reduce((acc, s) => acc + s.perguntas.filter((p) => p.ativa).length, 0),
    };
  });
}

export interface FormularioDetalhe {
  id: string;
  nome: string;
  descricao: string | null;
  slug: string;
  ativo: boolean;
  mensagem_sucesso: string | null;
  secoes: SecaoResolvida[];
}

export async function carregarFormulario(db: Db, id: string): Promise<FormularioDetalhe | null> {
  const { rows } = await db.query(
    'SELECT id, nome, descricao, slug, ativo, mensagem_sucesso, config FROM formularios WHERE id = $1',
    [id]
  );
  if (!rows[0]) return null;
  const { config, ...f } = rows[0];
  return { ...f, secoes: montarFormulario(config) };
}

async function slugDisponivel(base: string): Promise<string> {
  // O slug é único entre todas as empresas; o RLS esconde os das outras, então tenta com sufixo aleatório
  for (let i = 0; i < 5; i++) {
    const slug = `${base}-${sufixo()}`;
    const { rows } = await systemQuery('SELECT 1 FROM formularios WHERE slug = $1', [slug]);
    if (!rows.length) return slug;
  }
  throw new UserError('Não foi possível gerar o endereço do formulário. Tente novamente.');
}

export async function criarFormulario(db: Db, tenantId: string, nome = 'Novo formulário'): Promise<string> {
  const slug = await slugDisponivel(slugify(nome));
  const { rows } = await db.query<{ id: string }>(
    'INSERT INTO formularios (tenant_id, nome, slug, config) VALUES ($1, $2, $3, $4) RETURNING id',
    [tenantId, nome, slug, extrairConfig(montarFormulario({}))]
  );
  return rows[0].id;
}

export async function salvarFormulario(db: Db, id: string, input: FormularioInput) {
  try {
    const res = await db.query(
      `UPDATE formularios SET nome = $1, descricao = $2, slug = $3, ativo = $4, mensagem_sucesso = $5,
              config = $6, updated_at = now()
        WHERE id = $7`,
      [input.nome, input.descricao ?? null, input.slug, input.ativo, input.mensagem_sucesso ?? null, input.config, id]
    );
    if (res.rowCount === 0) throw new UserError('Formulário não encontrado.');
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw new UserError('Este endereço já está em uso. Escolha outro.');
    throw err;
  }
}

export async function duplicarFormulario(db: Db, tenantId: string, id: string): Promise<string> {
  const original = await carregarFormulario(db, id);
  if (!original) throw new UserError('Formulário não encontrado.');
  const nome = `${original.nome} (cópia)`.slice(0, 120);
  const slug = await slugDisponivel(slugify(original.nome));
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO formularios (tenant_id, nome, descricao, slug, ativo, mensagem_sucesso, config)
     SELECT $1, $2, descricao, $3, false, mensagem_sucesso, config FROM formularios WHERE id = $4 RETURNING id`,
    [tenantId, nome, slug, id]
  );
  return rows[0].id;
}

export async function excluirFormulario(db: Db, id: string) {
  const res = await db.query('DELETE FROM formularios WHERE id = $1', [id]);
  if (res.rowCount === 0) throw new UserError('Formulário não encontrado.');
}

export interface RespostaRow {
  id: string;
  created_at: Date;
  nome: string | null;
  email: string | null;
  natureza: string | null;
  evento_id: string | null;
  evento_titulo: string | null;
}

export async function listarRespostas(db: Db, formularioId: string, page: PageParams) {
  const [lista, total] = await Promise.all([
    db.query<RespostaRow>(
      `SELECT r.id, r.created_at, e.id AS evento_id, e.titulo AS evento_titulo,
              (SELECT d->>'valor' FROM jsonb_array_elements(r.dados) d WHERE d->>'chave' = 'nome') AS nome,
              (SELECT d->>'valor' FROM jsonb_array_elements(r.dados) d WHERE d->>'chave' = 'email') AS email,
              (SELECT d->>'valor' FROM jsonb_array_elements(r.dados) d WHERE d->>'chave' = 'natureza') AS natureza
         FROM formulario_respostas r
         LEFT JOIN eventos e ON e.id = r.evento_id
        WHERE r.formulario_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3`,
      [formularioId, page.pageSize, page.offset]
    ),
    db.query<{ total: number }>('SELECT count(*)::int AS total FROM formulario_respostas WHERE formulario_id = $1', [formularioId]),
  ]);
  return { rows: lista.rows, total: total.rows[0].total };
}

/** Respostas que originaram o evento (a mais recente, se houver mais de uma). */
export async function respostasDoEvento(
  db: Db,
  eventoId: string
): Promise<{ formulario: string | null; created_at: Date; dados: RespostaResumo[] } | null> {
  const { rows } = await db.query(
    `SELECT f.nome AS formulario, r.created_at, r.dados
       FROM formulario_respostas r LEFT JOIN formularios f ON f.id = r.formulario_id
      WHERE r.evento_id = $1 ORDER BY r.created_at DESC LIMIT 1`,
    [eventoId]
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Página pública
// ---------------------------------------------------------------------------
export interface FormularioPublico {
  id: string;
  tenantId: string;
  nome: string;
  mensagem_sucesso: string | null;
  secoes: SecaoResolvida[];
  empresa: { nome: string; logo_path: string | null };
}

/** Resolve o slug (sem sessão) e carrega o formulário ativo dentro do tenant dono. */
export async function formularioPublico(slug: string): Promise<FormularioPublico | null> {
  const { rows } = await systemQuery<{ id: string; tenant_id: string }>(
    'SELECT id, tenant_id FROM formularios WHERE slug = $1 AND ativo',
    [slug.toLowerCase()]
  );
  const alvo = rows[0];
  if (!alvo) return null;
  return withTenant(alvo.tenant_id, async (db) => {
    const res = await db.query(
      `SELECT f.id, f.nome, f.mensagem_sucesso, f.config, t.nome AS empresa_nome, t.logo_path
         FROM formularios f JOIN tenants t ON t.id = f.tenant_id
        WHERE f.id = $1`,
      [alvo.id]
    );
    const f = res.rows[0];
    if (!f) return null;
    return {
      id: f.id,
      tenantId: alvo.tenant_id,
      nome: f.nome,
      mensagem_sucesso: f.mensagem_sucesso,
      secoes: montarFormulario(f.config),
      empresa: { nome: f.empresa_nome, logo_path: f.logo_path },
    };
  });
}

const texto = (v: unknown) => (typeof v === 'string' && v ? v : null);

async function idPorNome(db: Db, tabela: string, padrao: string | null): Promise<string | null> {
  if (!padrao) return null;
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM ${tabela} WHERE nome ILIKE $1 ORDER BY nome LIMIT 1`, [padrao]);
  return rows[0]?.id ?? null;
}

const CATEGORIA_POR_OCASIAO: Record<string, string> = {
  casamento: 'casamento%',
  debutante: '%15 anos%',
  aniversario: 'anivers%',
};

const FORMATO_POR_OPCAO: Record<string, string> = {
  coquetel: 'coquetel%',
  ilhas: 'ilhas%',
  empratado: 'empratado%',
};

async function clienteDoPedido(db: Db, tenantId: string, r: Respostas): Promise<string> {
  const email = texto(r.email)!.toLowerCase();
  const { rows } = await db.query<{ id: string }>('SELECT id FROM clientes WHERE lower(email) = $1 LIMIT 1', [email]);
  if (rows[0]) return rows[0].id;
  const empresa = r.natureza === 'B2B' ? texto(r.b2b_empresa) : null;
  return salvarCliente(
    db,
    tenantId,
    null,
    clienteSchema.parse({
      tipo_pessoa: empresa ? 'PJ' : 'PF',
      nome: empresa ?? r.nome,
      email,
      telefone: r.whatsapp,
      observacoes: empresa ? `Contato: ${r.nome}` : null,
    })
  );
}

/** Converte as respostas do formulário no briefing do evento (campos sem coluna ficam só no snapshot). */
async function briefingDoPedido(db: Db, r: Respostas, clienteId: string) {
  const b2b = r.natureza === 'B2B';
  const numero = (v: unknown) => (typeof v === 'string' && v ? Math.round(Number(v.replace(',', '.'))) : 0);
  const convidados = b2b ? numero(r.b2b_participantes) : numero(r.b2c_adultos) + numero(r.b2c_criancas);
  const comentario = [
    texto(r.detalhes),
    texto(r.b2c_restricoes) && `Restrições alimentares: ${r.b2c_restricoes}`,
    texto(r.b2b_aprovacao) && `Processo de aprovação: ${r.b2b_aprovacao}`,
    Array.isArray(r.b2b_compliance) && r.b2b_compliance.includes('tres_orcamentos') && 'Precisa de 3 orçamentos comparativos.',
  ].filter(Boolean);

  return eventoSchema.parse({
    cliente_id: clienteId,
    cliente_novo: '0',
    titulo: b2b && texto(r.b2b_empresa) ? `Corporativo – ${r.b2b_empresa}` : '',
    tipo_evento_id: await idPorNome(db, 'tipos_evento', b2b ? 'corporativo' : r.natureza === 'B2C' ? 'social' : null),
    categoria_evento_id: b2b ? null : await idPorNome(db, 'categorias_evento', CATEGORIA_POR_OCASIAO[texto(r.b2c_ocasiao) ?? ''] ?? null),
    formato_servico_id: await idPorNome(db, 'formatos_servico', FORMATO_POR_OPCAO[texto(r.formato_servico) ?? ''] ?? null),
    data_evento: texto(b2b ? r.b2b_data : r.b2c_data) ?? '',
    numero_convidados: convidados > 0 ? String(convidados) : '',
    perfil_convidados: rotuloOpcao('b2b_perfil', texto(r.b2b_perfil)) ?? '',
    local_tipo: r.local_tipo === 'externo' ? 'externo' : 'casa',
    infraestrutura: rotuloOpcao('infraestrutura', texto(r.infraestrutura)) ?? '',
    endereco: texto(r.regiao) ?? '',
    responsavel_nome: r.nome,
    responsavel_email: r.email,
    responsavel_whatsapp: r.whatsapp,
    convite_experiencia: rotuloOpcao('degustacao', texto(r.degustacao)) ?? '',
    bebidas_alcoolicas: rotuloOpcao('bebidas', texto(r.bebidas)) ?? '',
    compliance: Array.isArray(r.b2b_compliance) ? r.b2b_compliance : [],
    staff_terceiros: numero(r.b2c_staff) > 0 ? `${numero(r.b2c_staff)} profissionais de terceiros` : '',
    comentario_cliente: comentario.join('\n\n'),
  });
}

/**
 * Registra um pedido vindo do formulário público: valida as respostas contra a configuração atual,
 * reutiliza o cliente pelo e-mail (ou cria), cria o evento no status de entrada e guarda o snapshot.
 */
export async function receberResposta(formulario: FormularioPublico, dados: Record<string, unknown>, ip: string) {
  const respostas = validarRespostas(formulario.secoes, dados);
  return withTenant(formulario.tenantId, async (db) => {
    const clienteId = await clienteDoPedido(db, formulario.tenantId, respostas);
    const briefing = await briefingDoPedido(db, respostas, clienteId);
    const eventoId = await criarEvento(db, { tenantId: formulario.tenantId, id: null }, briefing, null, 'formulario');
    await db.query(
      `INSERT INTO formulario_respostas (tenant_id, formulario_id, evento_id, cliente_id, dados, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [formulario.tenantId, formulario.id, eventoId, clienteId, JSON.stringify(resumirRespostas(formulario.secoes, respostas)), ip]
    );
    return eventoId;
  });
}

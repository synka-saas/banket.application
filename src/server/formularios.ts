// Formulários públicos de captação: configuração (a partir do modelo), página pública e respostas.
import { avisarWhatsapp } from './whatsapp';
import { TEMPO_RESPOSTA_PADRAO, rotuloTempo } from '../lib/tempoResposta';
import { z } from 'zod';
import { systemQuery, withTenant, type Db } from '../lib/db';
import { sendMail } from '../lib/mail';
import { exigirLimiteDb } from '../lib/planos/gating';
import { CONTAGEM_SQL, destinatarios } from './planos';
import { appUrl } from '../lib/mail';
import { TIPOS_EVENTO } from '../lib/busca/catalogos';
import { UserError, optionalText, requiredText } from '../lib/forms';
import type { PageParams } from '../lib/pagination';
import {
  configSchema,
  extrairConfig,
  montarFormulario,
  resumirRespostas,
  rotuloOpcao,
  validarRespostas,
  type OcasioesPorFluxo,
  type RespostaResumo,
  type Respostas,
  type SecaoResolvida,
} from '../lib/formularios/modelo';
import { clienteSchema, salvarCliente } from './clientes';
import { criarEvento, eventoSchema } from './eventos';
import { espacoPadraoId } from './espacos';
import { emailLayout } from './emails';

// ---------------------------------------------------------------------------
// Ocasiões por fluxo: as perguntas "Ocasião" de cada fluxo listam as ocasiões ligadas ao tipo
// (B2B = Corporativo, B2C = Social) na matriz de Configurações › Ocasiões. O valor da resposta é o id da ocasião.
// ---------------------------------------------------------------------------
const FLUXO_POR_TIPO = { corporativo: 'B2B', social: 'B2C' } as const;

export async function ocasioesPorFluxo(db: Db): Promise<OcasioesPorFluxo> {
  const { rows } = await db.query<{ id: string; nome: string; slug: keyof typeof FLUXO_POR_TIPO }>(
    `SELECT c.id, c.nome, t.slug
       FROM categoria_evento_tipos cet
       JOIN categorias_evento c ON c.id = cet.categoria_id
       JOIN tipos_evento t ON t.id = cet.tipo_evento_id
      ORDER BY lower(c.nome)`
  );
  const resultado: OcasioesPorFluxo = { B2B: [], B2C: [] };
  for (const r of rows) resultado[FLUXO_POR_TIPO[r.slug]]?.push({ valor: r.id, rotulo: r.nome });
  return resultado;
}

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
  /** Marcado pela empresa para o pedido de orçamento do Banket Busca */
  usar_no_busca: boolean;
  /** É o formulário que abre no Banket Busca (o marcado ou, sem marca, o ativo mais antigo) */
  no_busca: boolean;
  secoes_ativas: number;
  perguntas_ativas: number;
  respostas: number;
  ultima_resposta: Date | null;
}

export async function listarFormularios(db: Db, busca: string | null): Promise<FormularioResumo[]> {
  const { rows } = await db.query(
    `SELECT f.id, f.nome, f.descricao, f.slug, f.ativo, f.usar_no_busca, f.config,
            f.id = (SELECT b.id FROM formularios b WHERE b.ativo ORDER BY b.usar_no_busca DESC, b.created_at, b.id LIMIT 1) AS no_busca,
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

/** Marca o formulário que abre no pedido de orçamento do Banket Busca (um por empresa; precisa estar ativo). */
export async function usarNoBusca(db: Db, id: string): Promise<string> {
  const { rows } = await db.query<{ nome: string; ativo: boolean }>('SELECT nome, ativo FROM formularios WHERE id = $1', [id]);
  if (!rows[0]) throw new UserError('Formulário não encontrado.');
  if (!rows[0].ativo) throw new UserError('Ative o formulário antes de usá-lo no Banket Busca.');
  await db.query('UPDATE formularios SET usar_no_busca = false WHERE usar_no_busca AND id <> $1', [id]);
  await db.query('UPDATE formularios SET usar_no_busca = true, updated_at = now() WHERE id = $1', [id]);
  return rows[0].nome;
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
  return { ...f, secoes: montarFormulario(config, await ocasioesPorFluxo(db)) };
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
  await exigirLimiteDb(db, 'formularios_qtd', CONTAGEM_SQL.formularios_qtd, 'formulários ativos');
  const slug = await slugDisponivel(slugify(nome));
  const { rows } = await db.query<{ id: string }>(
    'INSERT INTO formularios (tenant_id, nome, slug, config) VALUES ($1, $2, $3, $4) RETURNING id',
    [tenantId, nome, slug, extrairConfig(montarFormulario({}))]
  );
  return rows[0].id;
}

export async function salvarFormulario(db: Db, id: string, input: FormularioInput) {
  if (input.ativo) {
    const { rows: antes } = await db.query<{ ativo: boolean }>('SELECT ativo FROM formularios WHERE id = $1', [id]);
    if (antes[0] && !antes[0].ativo) await exigirLimiteDb(db, 'formularios_qtd', CONTAGEM_SQL.formularios_qtd, 'formulários ativos');
  }
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

/** Linha do snapshot legível gravado em formulario_respostas.dados */
export interface LinhaResposta {
  secao: string;
  chave: string;
  rotulo: string;
  valor: string;
}

export interface RespostaRow {
  id: string;
  created_at: Date;
  dados: LinhaResposta[];
  nome: string | null;
  email: string | null;
  natureza: string | null;
  evento_id: string | null;
  evento_titulo: string | null;
}

export interface FiltroRespostas {
  de?: string | null;
  ate?: string | null;
}

const WHERE_RESPOSTAS = `WHERE r.formulario_id = $1
        AND ($2::date IS NULL OR r.created_at >= $2::date)
        AND ($3::date IS NULL OR r.created_at < $3::date + 1)`;

export async function listarRespostas(db: Db, formularioId: string, page: PageParams, filtro: FiltroRespostas = {}) {
  const params = [formularioId, filtro.de ?? null, filtro.ate ?? null];
  const [lista, total] = await Promise.all([
    db.query<RespostaRow>(
      `SELECT r.id, r.created_at, r.dados, e.id AS evento_id, e.titulo AS evento_titulo,
              (SELECT d->>'valor' FROM jsonb_array_elements(r.dados) d WHERE d->>'chave' = 'nome') AS nome,
              (SELECT d->>'valor' FROM jsonb_array_elements(r.dados) d WHERE d->>'chave' = 'email') AS email,
              (SELECT d->>'valor' FROM jsonb_array_elements(r.dados) d WHERE d->>'chave' = 'natureza') AS natureza
         FROM formulario_respostas r
         LEFT JOIN eventos e ON e.id = r.evento_id
        ${WHERE_RESPOSTAS}
        ORDER BY r.created_at DESC
        LIMIT $4 OFFSET $5`,
      [...params, page.pageSize, page.offset]
    ),
    db.query<{ total: number }>(`SELECT count(*)::int AS total FROM formulario_respostas r ${WHERE_RESPOSTAS}`, params),
  ]);
  return { rows: lista.rows, total: total.rows[0].total };
}

/** Todas as respostas do recorte, para a exportação CSV (mais antigas primeiro). */
export async function respostasParaExportar(db: Db, formularioId: string, filtro: FiltroRespostas = {}) {
  const { rows } = await db.query<{ created_at: Date; dados: LinhaResposta[]; evento_id: string | null }>(
    `SELECT r.created_at, r.dados, r.evento_id
       FROM formulario_respostas r
      ${WHERE_RESPOSTAS}
      ORDER BY r.created_at`,
    [formularioId, filtro.de ?? null, filtro.ate ?? null]
  );
  return rows;
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
export async function formularioPublico(slug: string, incluirInativos = false): Promise<FormularioPublico | null> {
  const { rows } = await systemQuery<{ id: string; tenant_id: string }>(
    `SELECT id, tenant_id FROM formularios WHERE slug = $1 AND (ativo OR $2)`,
    [slug.toLowerCase(), incluirInativos]
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
      secoes: montarFormulario(f.config, await ocasioesPorFluxo(db)),
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ocasião respondida: id da ocasião (atual) ou chave antiga do B2C (casamento, debutante, aniversario). */
async function ocasiaoDoPedido(db: Db, valor: string | null): Promise<string | null> {
  if (!valor) return null;
  if (UUID.test(valor)) {
    const { rows } = await db.query<{ id: string }>('SELECT id FROM categorias_evento WHERE id = $1', [valor]);
    return rows[0]?.id ?? null;
  }
  return idPorNome(db, 'categorias_evento', CATEGORIA_POR_OCASIAO[valor] ?? null);
}

async function tipoPorSlug(db: Db, slug: 'corporativo' | 'social' | null): Promise<string | null> {
  if (!slug) return null;
  const { rows } = await db.query<{ id: string }>('SELECT id FROM tipos_evento WHERE slug = $1', [slug]);
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
    tipo_evento_id: await tipoPorSlug(db, b2b ? 'corporativo' : r.natureza === 'B2C' ? 'social' : null),
    categoria_evento_id: await ocasiaoDoPedido(db, texto(b2b ? r.b2b_ocasiao : r.b2c_ocasiao)),
    formato_servico_id: await idPorNome(db, 'formatos_servico', FORMATO_POR_OPCAO[texto(r.formato_servico) ?? ''] ?? null),
    data_evento: texto(b2b ? r.b2b_data : r.b2c_data) ?? '',
    numero_convidados: convidados > 0 ? String(convidados) : '',
    perfil_convidados: rotuloOpcao('b2b_perfil', texto(r.b2b_perfil)) ?? '',
    // No nosso espaço = espaço padrão da empresa (se houver); externo fica como texto livre
    espaco_id: r.local_tipo === 'externo' ? '' : ((await espacoPadraoId(db)) ?? ''),
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

/** Pedido vindo do perfil público do Banket Busca: o perfil (unidade) que recebeu e o tipo de evento da busca. */
export interface OrigemBusca {
  perfilId: string;
  tipo: string | null;
}

/** Registra o pedido do Banket Busca em busca_pedidos (base das avaliações). */
async function registrarPedidoBusca(db: Db, tenantId: string, origem: OrigemBusca, r: Respostas, eventoId: string, clienteId: string, ip: string) {
  const b2b = r.natureza === 'B2B';
  const numero = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : 0);
  const convidados = b2b ? numero(r.b2b_participantes) : numero(r.b2c_adultos) + numero(r.b2c_criancas);
  const data = texto(b2b ? r.b2b_data : r.b2c_data);
  const tipo = TIPOS_EVENTO.some((t) => t.slug === origem.tipo) ? origem.tipo! : b2b ? 'corporativo' : 'outros';
  await db.query(
    `INSERT INTO busca_pedidos (tenant_id, perfil_id, grupo_id, evento_id, cliente_id, tipo_evento, data_evento, convidados,
                                nome, email, whatsapp, aceite_contato, ip)
     VALUES ($1, $2, gen_random_uuid(), $3, $4, $5, $6, $7, $8, $9, $10, true, $11)`,
    [tenantId, origem.perfilId, eventoId, clienteId, tipo, data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null,
     convidados > 0 ? convidados : null, String(r.nome).slice(0, 255), String(r.email).trim().toLowerCase().slice(0, 255),
     texto(r.whatsapp)?.replace(/\D/g, '').slice(0, 20) ?? null, ip.slice(0, 64)]
  );
}

/** Aviso de pedido novo pelo Banket Busca para owner/admin (melhor esforço: o pedido já está no kanban). */
async function avisarPedidoBusca(pessoas: { nome: string; email: string }[], perfil: string, eventoId: string, r: Respostas) {
  const resumo = [texto(r.nome), texto(r.natureza === 'B2B' ? r.b2b_data : r.b2c_data)?.split('-').reverse().join('/')].filter(Boolean).join(' · ');
  for (const p of pessoas) {
    const { html, text } = emailLayout({
      titulo: 'Novo pedido de orçamento pelo Banket Busca',
      paragrafos: [
        `Olá, ${p.nome.split(/\s+/)[0]}!`,
        `${perfil} recebeu um pedido de orçamento pelo Banket Busca${resumo ? ` (${resumo})` : ''}. Ele já está na coluna de entrada do Painel de Propostas, com o e-mail e o WhatsApp do cliente.`,
        'Quem responde primeiro costuma fechar o evento.',
      ],
      cta: { texto: 'Abrir o pedido', url: appUrl(`/eventos/${eventoId}`) },
      rodape: 'Você recebeu este aviso porque é proprietário ou administrador da empresa no Banket.',
    });
    await sendMail({ to: p.email, subject: `Novo pedido pelo Banket Busca — ${perfil}`, html, text }).catch((err: unknown) =>
      console.error('Falha ao avisar o pedido do Banket Busca:', err)
    );
  }
}

/**
 * Registra um pedido vindo do formulário público: valida as respostas contra a configuração atual,
 * reutiliza o cliente pelo e-mail (ou cria), cria o evento no status de entrada e guarda o snapshot.
 * Vindo do Banket Busca (`busca`), o evento tem origem 'busca', o pedido fica em busca_pedidos e owner/admin recebem
 * um e-mail.
 */
export async function receberResposta(formulario: FormularioPublico, dados: Record<string, unknown>, ip: string, busca: OrigemBusca | null = null) {
  const respostas = validarRespostas(formulario.secoes, dados);
  const aviso: { perfil: string | null; pessoas: { nome: string; email: string }[]; whatsapp: (string | number | null)[] } = { perfil: null, pessoas: [], whatsapp: [] };
  return withTenant(formulario.tenantId, async (db) => {
    const clienteId = await clienteDoPedido(db, formulario.tenantId, respostas);
    const briefing = await briefingDoPedido(db, respostas, clienteId);
    // O perfil precisa ser da empresa do formulário (a RLS esconde os das outras)
    const perfil = busca && UUID.test(busca.perfilId)
      ? (await db.query<{ nome: string }>('SELECT nome FROM busca_perfis WHERE id = $1', [busca.perfilId])).rows[0]?.nome ?? null
      : null;
    const eventoId = await criarEvento(db, { tenantId: formulario.tenantId, id: null }, briefing, null, perfil ? 'busca' : 'formulario');
    await db.query(
      `INSERT INTO formulario_respostas (tenant_id, formulario_id, evento_id, cliente_id, dados, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [formulario.tenantId, formulario.id, eventoId, clienteId, JSON.stringify(resumirRespostas(formulario.secoes, respostas)), ip]
    );
    if (perfil && busca) {
      await registrarPedidoBusca(db, formulario.tenantId, busca, respostas, eventoId, clienteId, ip);
      aviso.perfil = perfil;
      aviso.pessoas = await destinatarios(db, formulario.tenantId);
    }
    // Dados do aviso no WhatsApp (enviado depois do commit)
    const { rows: [ev] } = await db.query<{ cliente: string | null; evento: string; data: string | null; convidados: number | null; horas: number | null }>(
      `SELECT cl.nome AS cliente, coalesce(ce.nome, e.titulo) AS evento, to_char(e.data_evento, 'DD/MM/YYYY') AS data,
              e.numero_convidados AS convidados, (SELECT tempo_resposta_horas FROM configuracoes_tenant) AS horas
         FROM eventos e LEFT JOIN clientes cl ON cl.id = e.cliente_id LEFT JOIN categorias_evento ce ON ce.id = e.categoria_evento_id
        WHERE e.id = $1`,
      [eventoId]
    );
    aviso.whatsapp = [ev?.cliente ?? 'Cliente', ev?.evento ?? 'Evento', ev?.data ?? 'a definir', ev?.convidados ?? 'a definir',
      perfil ? 'Banket Busca' : `Formulário ${formulario.nome}`, rotuloTempo(ev?.horas ?? TEMPO_RESPOSTA_PADRAO)];
    return eventoId;
  }).then(async (eventoId) => {
    if (aviso.perfil) await avisarPedidoBusca(aviso.pessoas, aviso.perfil, eventoId, respostas);
    await avisarWhatsapp(formulario.tenantId, 'novo_pedido', {
      variaveis: aviso.whatsapp, link: `eventos/${eventoId}`, eventoId, chave: `pedido:${eventoId}`,
    });
    // Confirmação para quem preencheu (UX-072): melhor esforço, o pedido já foi registrado
    const email = typeof respostas.email === 'string' ? respostas.email.trim() : '';
    const nome = typeof respostas.nome === 'string' ? respostas.nome.trim().split(/\s+/)[0] : '';
    if (email) {
      const { html, text } = emailLayout({
        titulo: 'Recebemos o seu pedido!',
        paragrafos: [
          `Olá${nome ? `, ${nome}` : ''}!`,
          `O seu pedido de orçamento chegou para a equipe de ${formulario.empresa.nome}, que vai analisar os detalhes do seu evento e retornar em breve.`,
          'Se lembrar de algum detalhe importante, é só responder este e-mail.',
        ],
        rodape: `Você recebeu esta mensagem porque preencheu o formulário de ${formulario.empresa.nome}.`,
      });
      await sendMail({ to: email, subject: `Recebemos o seu pedido — ${formulario.empresa.nome}`, html, text }).catch((err: unknown) =>
        console.error('Falha ao enviar a confirmação do formulário:', err)
      );
    }
    return eventoId;
  });
}

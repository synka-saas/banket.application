// Leituras públicas do Banket Busca (vitrine): cruzam empresas, então rodam na conexão de sistema, sempre numa
// transação READ ONLY e sempre filtrando perfis publicados de empresas ativas. É o ÚNICO módulo do Busca que lê
// sem RLS; só colunas públicas saem daqui. Escritas da vitrine (pedido, avaliação, métricas) entram por withTenant.
import { withLeituraPublica, withSystem, type Db } from '../../lib/db';
import { slugTexto } from '../../lib/busca/geo';
import { urlMidia } from './perfil';
import { POR_PAGINA, semFiltrosSecundarios, type Criterios } from '../../lib/busca/filtros';
import { compativel, disponibilidade, passaFiltros, type CandidatoBusca } from '../../lib/busca/matching';
import { lerPesos, ordenar, type Rankeavel } from '../../lib/busca/ranking';
import { RESTRICOES, TIPOS_SERVICO } from '../../lib/busca/catalogos';

export interface Cidade {
  id: number;
  nome: string;
  uf: string;
  slug: string;
  lat: number;
  lng: number;
}

/** Transação somente leitura no pool da vitrine (lib/db: withLeituraPublica). */
export const leituraPublica = withLeituraPublica;

/** Condição dos perfis visíveis na vitrine (alias p = busca_perfis, t = tenants). */
export const PERFIL_VISIVEL = `p.publicado AND t.status = 'active'`;

/** UF de foco da vitrine no lançamento: desempata cidades homônimas (Santo André SP × PB). */
const UF_FOCO = 'SP';

/** Autocomplete de cidade: prefixo e semelhança sem acento; cidades com buffets publicados, a UF de foco e capitais primeiro. */
export async function buscarCidades(termo: string, limite = 8): Promise<Cidade[]> {
  const q = slugTexto(termo, 60).replace(/-/g, ' ').trim();
  if (q.length < 2) return [];
  return leituraPublica(async (db) => {
    const { rows } = await db.query<Cidade>(
      `SELECT c.id, c.nome, c.uf, c.slug, c.lat, c.lng FROM busca_cidades c
        WHERE busca_sem_acento(c.nome) LIKE $1 || '%' OR busca_sem_acento(c.nome) % $1
        ORDER BY (busca_sem_acento(c.nome) LIKE $1 || '%') DESC,
                 (SELECT count(*) FROM busca_perfis p WHERE p.cidade_id = c.id AND p.publicado) DESC,
                 (c.uf = $3) DESC, c.capital DESC, similarity(busca_sem_acento(c.nome), $1) DESC, c.nome
        LIMIT $2`,
      [q, Math.min(Math.max(limite, 1), 20), UF_FOCO]
    );
    return rows;
  });
}

export async function cidadePorSlug(slug: string): Promise<Cidade | null> {
  if (!/^[a-z0-9-]{3,140}$/.test(slug)) return null;
  return leituraPublica(async (db) => {
    const { rows } = await db.query<Cidade>('SELECT id, nome, uf, slug, lat, lng FROM busca_cidades WHERE slug = $1', [slug]);
    return rows[0] ?? null;
  });
}

export interface PerfilPublico {
  tenantId: string;
  slug: string;
  nome: string;
  descricao: string | null;
  logo: string | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  tipos_evento: string[];
  tipos_servico: string[];
  restricoes: string[];
  atende_domicilio: boolean;
  raio_km: number | null;
  espaco_proprio: boolean;
  capacidade_min: number | null;
  capacidade_max: number | null;
  nivel: 'gratuito' | 'cliente';
  nota_media: number | null;
  total_avaliacoes: number;
  tempo_resposta_texto: string | null;
  instagram: string | null;
  site: string | null;
  fotos: { url: string; legenda: string | null; tags: string[] }[];
  atualizado_em: Date;
  publicado: boolean;
}

/**
 * Perfil publicado pelo slug (null se não existe, não publicado ou empresa suspensa). `previaDoTenant`: o dono logado vê
 * o próprio perfil ainda não publicado (prévia); nunca o de outra empresa.
 */
export async function perfilPublico(slug: string, previaDoTenant: string | null = null): Promise<PerfilPublico | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  return leituraPublica(async (db) => {
    const { rows } = await db.query(
      `SELECT p.id, p.tenant_id, p.slug, p.nome, p.descricao, p.logo_path, c.nome AS cidade, c.uf, p.bairro,
              p.tipos_evento, p.tipos_servico, p.restricoes, p.atende_domicilio, p.raio_km, p.espaco_proprio,
              p.capacidade_min, p.capacidade_max, p.nivel, p.nota_media, p.total_avaliacoes, p.tempo_resposta_texto,
              p.instagram, p.site, p.updated_at, p.publicado
         FROM busca_perfis p JOIN tenants t ON t.id = p.tenant_id LEFT JOIN busca_cidades c ON c.id = p.cidade_id
        WHERE p.slug = $1 AND (${PERFIL_VISIVEL} OR (p.tenant_id = $2::uuid AND t.status = 'active'))`,
      [slug, previaDoTenant]
    );
    const p = rows[0];
    if (!p) return null;
    // Um client só faz uma consulta por vez (pg): em sequência
    const fotos = await db.query(`SELECT path, legenda, tags FROM busca_fotos WHERE perfil_id = $1 AND bloqueado_plano_em IS NULL ORDER BY capa DESC, ordem, created_at`, [p.id]);
    return {
      tenantId: p.tenant_id, slug: p.slug, nome: p.nome, descricao: p.descricao, logo: urlMidia(p.tenant_id, p.logo_path),
      cidade: p.cidade, uf: p.uf, bairro: p.bairro, tipos_evento: p.tipos_evento, tipos_servico: p.tipos_servico,
      restricoes: p.restricoes, atende_domicilio: p.atende_domicilio, raio_km: p.raio_km, espaco_proprio: p.espaco_proprio,
      capacidade_min: p.capacidade_min, capacidade_max: p.capacidade_max, nivel: p.nivel, nota_media: p.nota_media,
      total_avaliacoes: p.total_avaliacoes, tempo_resposta_texto: p.tempo_resposta_texto, instagram: p.instagram, site: p.site,
      fotos: fotos.rows.map((f) => ({ url: urlMidia(p.tenant_id, f.path)!, legenda: f.legenda, tags: f.tags })),
      atualizado_em: p.updated_at,
      publicado: p.publicado,
    };
  });
}

// ---------------------------------------------------------------------------
// Busca, destaques e perfil completo (fase 3)
// ---------------------------------------------------------------------------

/** Até onde o pré-filtro SQL olha em volta da cidade (a decisão fina é de lib/busca/matching). */
const RAIO_PREFILTRO_M = 200_000;

export interface ItemResultado extends CandidatoBusca, Rankeavel {
  tenantId: string;
  slug: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  foto: string | null;
  selo: boolean;
  disponibilidade: 'disponivel' | 'indisponivel' | 'consultar' | null;
}

function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

/**
 * Cidade pelo slug completo ("campinas-sp") ou curto ("campinas"): o curto escolhe a cidade com buffets publicados
 * e, no empate, a UF de foco.
 */
export async function resolverCidade(slug: string | null): Promise<Cidade | null> {
  if (!slug || !/^[a-z0-9-]{2,140}$/.test(slug)) return null;
  return leituraPublica(async (db) => {
    const { rows } = await db.query<Cidade>(
      `SELECT c.id, c.nome, c.uf, c.slug, c.lat, c.lng FROM busca_cidades c
        WHERE c.slug = $1 OR c.slug ~ ('^' || $1 || '-[a-z]{2}$')
        ORDER BY (c.slug = $1) DESC, (SELECT count(*) FROM busca_perfis p WHERE p.cidade_id = c.id AND p.publicado) DESC,
                 (c.uf = $2) DESC, c.capital DESC
        LIMIT 1`,
      [slug, UF_FOCO]
    );
    return rows[0] ?? null;
  });
}

/** Slug curto da cidade (sem a UF) quando ele resolve para a mesma cidade; senão o completo. Usado nas URLs das landings. */
export async function slugCurtoDaCidade(c: Cidade): Promise<string> {
  const curto = c.slug.replace(/-[a-z]{2}$/, '');
  const r = await resolverCidade(curto);
  return r?.id === c.id ? curto : c.slug;
}

const SQL_CANDIDATOS = `
  SELECT p.id, p.tenant_id, p.slug, p.nome, p.bairro, c.nome AS cidade, c.uf, p.cidade_id, p.tipos_evento, p.tipos_servico,
         p.restricoes, p.atende_domicilio, p.raio_km, p.espaco_proprio, p.capacidade_min, p.capacidade_max, p.aceita_menor,
         p.completude, p.nota_media, p.total_avaliacoes, p.taxa_resposta, p.sincronizar_agenda,
         CASE WHEN $1::float8 IS NULL OR p.lat IS NULL THEN NULL
              ELSE earth_distance(ll_to_earth(p.lat, p.lng), ll_to_earth($1, $2)) / 1000 END AS distancia_km,
         ARRAY(SELECT pc.cidade_id FROM busca_perfil_cidades pc WHERE pc.perfil_id = p.id) AS cidades,
         (SELECT f.path FROM busca_fotos f WHERE f.perfil_id = p.id AND f.bloqueado_plano_em IS NULL ORDER BY f.capa DESC, f.ordem LIMIT 1) AS foto,
         fn_tenant_pode(p.tenant_id, 'busca_prioridade') AS prioridade,
         fn_tenant_pode(p.tenant_id, 'busca_selo') AS selo,
         fn_tenant_pode(p.tenant_id, 'busca_disponibilidade') AS agenda,
         CASE WHEN $5::date IS NULL THEN false ELSE (
           EXISTS (SELECT 1 FROM eventos e JOIN status_orcamento s ON s.id = e.status_id
                    WHERE e.tenant_id = p.tenant_id AND e.data_evento = $5::date AND s.variante = 'aprovado')
           OR EXISTS (SELECT 1 FROM busca_bloqueios b WHERE b.perfil_id = p.id AND $5::date BETWEEN b.data_inicio AND b.data_fim)
         ) END AS ocupado
    FROM busca_perfis p
    JOIN tenants t ON t.id = p.tenant_id
    LEFT JOIN busca_cidades c ON c.id = p.cidade_id
   WHERE ${PERFIL_VISIVEL}
     AND ($4::text IS NULL OR $4 = ANY(p.tipos_evento))
     AND ($1::float8 IS NULL OR p.cidade_id = $3
          OR EXISTS (SELECT 1 FROM busca_perfil_cidades pc WHERE pc.perfil_id = p.id AND pc.cidade_id = $3)
          OR (p.lat IS NOT NULL AND earth_box(ll_to_earth($1, $2), ${RAIO_PREFILTRO_M}) @> ll_to_earth(p.lat, p.lng)))
   LIMIT 1000`;

function paraItem(r: any, data: string | null): ItemResultado {
  const item: ItemResultado = {
    id: r.id, tenantId: r.tenant_id, slug: r.slug, nome: r.nome, bairro: r.bairro, cidade: r.cidade, uf: r.uf,
    cidadeId: r.cidade_id, cidadesAtendidas: r.cidades ?? [], tiposEvento: r.tipos_evento, tiposServico: r.tipos_servico,
    restricoes: r.restricoes, atendeDomicilio: r.atende_domicilio, raioKm: r.raio_km, espacoProprio: r.espaco_proprio,
    capacidadeMin: r.capacidade_min, capacidadeMax: r.capacidade_max, aceitaMenor: r.aceita_menor,
    distanciaKm: r.distancia_km == null ? null : Number(r.distancia_km),
    notaMedia: r.nota_media == null ? null : Number(r.nota_media), totalAvaliacoes: r.total_avaliacoes,
    taxaResposta: r.taxa_resposta == null ? null : Number(r.taxa_resposta), completude: r.completude,
    prioridade: r.prioridade === true, selo: r.selo === true, usaAgenda: r.agenda === true && r.sincronizar_agenda,
    ocupado: r.ocupado === true, foto: urlMidia(r.tenant_id, r.foto), disponibilidade: null,
  };
  item.disponibilidade = disponibilidade(item, data);
  return item;
}

async function candidatos(db: Db, crit: Pick<Criterios, 'tipo' | 'data'>, cidade: Cidade | null): Promise<ItemResultado[]> {
  const { rows } = await db.query(SQL_CANDIDATOS, [cidade?.lat ?? null, cidade?.lng ?? null, cidade?.id ?? null, crit.tipo, crit.data]);
  return rows.map((r) => paraItem(r, crit.data));
}

export interface Faceta {
  valor: string;
  rotulo: string;
  total: number;
}

export interface ResultadoBusca {
  cidade: Cidade | null;
  total: number;
  itens: ItemResultado[];
  /** Há mais itens além da página atual ("Mostrar mais") */
  temMais: boolean;
  facetas: { servicos: Faceta[]; restricoes: Faceta[]; local: Faceta[] };
  /** Estado vazio: quantos apareceriam afrouxando a busca */
  sugestoes: { chave: 'filtros' | 'data' | 'convidados' | 'raio'; total: number }[];
}

/** Busca da vitrine: compatibilidade → filtros → ranking → "Mostrar mais" (páginas acumuladas). */
export async function buscarBuffets(crit: Criterios): Promise<ResultadoBusca> {
  const cidade = await resolverCidade(crit.cidade);
  return leituraPublica(async (db) => {
    const todos = await candidatos(db, crit, cidade);
    const base = todos.filter((c) => compativel(c, crit, cidade));
    const filtrados = base.filter((c) => passaFiltros(c, crit, cidade));
    const ordenados = ordenar(filtrados, crit.ordem, lerPesos(env('BUSCA_RANKING_PESOS')), crit.raio ?? 30);
    const conta = (f: (c: ItemResultado) => boolean) => base.filter(f).length;
    const facetas = {
      servicos: TIPOS_SERVICO.map((s) => ({ valor: s.slug, rotulo: s.rotulo, total: conta((c) => c.tiposServico.includes(s.slug)) })).filter((f) => f.total > 0 || crit.servicos.includes(f.valor)),
      restricoes: RESTRICOES.map((r) => ({ valor: r.slug, rotulo: r.rotulo, total: conta((c) => c.restricoes.includes(r.slug)) })).filter((f) => f.total > 0 || crit.restricoes.includes(f.valor)),
      local: [
        { valor: 'espaco', rotulo: 'Espaço próprio do buffet', total: conta((c) => passaFiltros(c, { ...semFiltrosSecundarios(crit), local: 'espaco' }, cidade)) },
        { valor: 'domicilio', rotulo: 'Em domicílio', total: conta((c) => passaFiltros(c, { ...semFiltrosSecundarios(crit), local: 'domicilio' }, cidade)) },
      ],
    };
    const sugestoes: ResultadoBusca['sugestoes'] = [];
    if (!filtrados.length) {
      const semSec = semFiltrosSecundarios(crit);
      const total = (c: Criterios) => todos.filter((x) => compativel(x, c, cidade) && passaFiltros(x, c, cidade)).length;
      if (base.length) sugestoes.push({ chave: 'filtros', total: base.length });
      if (crit.data) sugestoes.push({ chave: 'data', total: total({ ...semSec, data: null }) });
      if (crit.convidados) sugestoes.push({ chave: 'convidados', total: total({ ...semSec, convidados: null }) });
      if (cidade) sugestoes.push({ chave: 'raio', total: total({ ...semSec, raio: 50 }) });
    }
    const limite = crit.pagina * POR_PAGINA;
    return {
      cidade, total: ordenados.length, itens: ordenados.slice(0, limite), temMais: ordenados.length > limite, facetas,
      sugestoes: sugestoes.filter((s) => s.total > 0),
    };
  });
}

/** Destaques da home: os mais bem colocados no ranking geral (clientes Banket primeiro). */
export async function destaques(limite = 6): Promise<ItemResultado[]> {
  return leituraPublica(async (db) => {
    const lista = await candidatos(db, { tipo: null, data: null }, null);
    return ordenar(lista.filter((c) => c.foto), 'relevancia', lerPesos(env('BUSCA_RANKING_PESOS'))).slice(0, limite);
  });
}

/** Quantos buffets publicados atendem cada tipo de evento (home e categorias). */
export async function totaisPorTipo(): Promise<Record<string, number>> {
  return leituraPublica(async (db) => {
    const { rows } = await db.query<{ tipo: string; n: number }>(
      `SELECT unnest(p.tipos_evento) AS tipo, count(*) AS n FROM busca_perfis p JOIN tenants t ON t.id = p.tenant_id
        WHERE ${PERFIL_VISIVEL} GROUP BY 1`
    );
    return Object.fromEntries(rows.map((r) => [r.tipo, Number(r.n)]));
  });
}

export interface Depoimento {
  nome: string;
  texto: string;
  nota: number;
  buffet: string;
  slug: string;
  tipoEvento: string;
  data: Date;
}

/** Avaliações reais, publicadas e bem dadas (nota ≥ 4), mais recentes primeiro. */
export async function depoimentos(limite = 3, perfilSlug?: string): Promise<Depoimento[]> {
  return leituraPublica(async (db) => {
    const { rows } = await db.query<Depoimento>(
      `SELECT a.nome_exibicao AS nome, a.texto, a.nota, p.nome AS buffet, p.slug, d.tipo_evento AS "tipoEvento", a.respondida_em AS data
         FROM busca_avaliacoes a JOIN busca_perfis p ON p.id = a.perfil_id JOIN tenants t ON t.id = p.tenant_id
         JOIN busca_pedidos d ON d.id = a.pedido_id
        WHERE a.publicada AND a.nota >= 4 AND length(coalesce(a.texto, '')) >= 20 AND ${PERFIL_VISIVEL}
          AND ($2::text IS NULL OR p.slug = $2)
        ORDER BY a.nota DESC, a.respondida_em DESC LIMIT $1`,
      [limite, perfilSlug ?? null]
    );
    return rows;
  });
}

export interface AvaliacaoPublica {
  nome: string;
  nota: number;
  texto: string | null;
  tipoEvento: string;
  data: Date;
  resposta: string | null;
}

/** Opção de cardápio do cliente Banket no perfil público: seções e itens, sem preço (o Busca não divulga preço). */
export interface CardapioPublico {
  id: string;
  nome: string;
  descricao: string | null;
  secoes: { titulo: string; escolha: number | null; itens: { nome: string; restricoes: string[] }[] }[];
}

export interface PerfilCompleto extends PerfilPublico {
  id: string;
  selo: boolean;
  usaAgenda: boolean;
  mostraCardapio: boolean;
  logradouro: string | null;
  numero: string | null;
  aceita_menor: boolean;
  cidadesAtendidas: string[];
  avaliacoes: AvaliacaoPublica[];
  distribuicao: Record<1 | 2 | 3 | 4 | 5, number>;
  /** Opções de cardápio ativas da empresa (só com o recurso busca_cardapios) */
  cardapios: CardapioPublico[];
  disponibilidade: 'disponivel' | 'indisponivel' | 'consultar' | null;
  /** Datas ocupadas nos próximos 90 dias (só cliente com agenda) */
  datasOcupadas: string[];
}

/** Perfil completo para a página pública: avaliações, cardápios (cliente Banket) e disponibilidade na data pedida. */
export async function perfilCompleto(slug: string, data: string | null, previaDoTenant: string | null = null): Promise<PerfilCompleto | null> {
  const base = await perfilPublico(slug, previaDoTenant);
  if (!base) return null;
  return leituraPublica(async (db) => {
    const { rows: [p] } = await db.query(
      `SELECT p.id, p.logradouro, p.numero, p.aceita_menor, p.sincronizar_agenda,
              fn_tenant_pode(p.tenant_id, 'busca_selo') AS selo,
              fn_tenant_pode(p.tenant_id, 'busca_disponibilidade') AS agenda,
              fn_tenant_pode(p.tenant_id, 'busca_cardapios') AS cardapios,
              ARRAY(SELECT c.nome FROM busca_perfil_cidades pc JOIN busca_cidades c ON c.id = pc.cidade_id WHERE pc.perfil_id = p.id ORDER BY c.nome) AS cidades
         FROM busca_perfis p WHERE p.slug = $1`,
      [slug]
    );
    const usaAgenda = p.agenda === true && p.sincronizar_agenda;
    const avs = await db.query<AvaliacaoPublica>(
        `SELECT a.nome_exibicao AS nome, a.nota, a.texto, d.tipo_evento AS "tipoEvento", a.respondida_em AS data, a.resposta_buffet AS resposta
           FROM busca_avaliacoes a JOIN busca_pedidos d ON d.id = a.pedido_id
          WHERE a.perfil_id = $1 AND a.publicada ORDER BY a.respondida_em DESC LIMIT 20`,
        [p.id]
      );
    const dist = await db.query<{ nota: number; n: number }>(`SELECT nota, count(*) AS n FROM busca_avaliacoes WHERE perfil_id = $1 AND publicada GROUP BY nota`, [p.id]);
    const ocupadas = await (usaAgenda
        ? db.query<{ d: string }>(
            `SELECT DISTINCT to_char(d, 'YYYY-MM-DD') AS d FROM (
               SELECT e.data_evento AS d FROM eventos e JOIN status_orcamento s ON s.id = e.status_id
                WHERE e.tenant_id = $1 AND s.variante = 'aprovado' AND e.data_evento BETWEEN current_date AND current_date + 90
               UNION ALL
               SELECT generate_series(greatest(b.data_inicio, current_date), least(b.data_fim, current_date + 90), interval '1 day')::date
                 FROM busca_bloqueios b WHERE b.perfil_id = $2
             ) x ORDER BY 1`,
            [base.tenantId, p.id]
          )
        : Promise.resolve({ rows: [] as { d: string }[] }));
    const mostraCardapio = p.cardapios === true;
    const cardapios: CardapioPublico[] = [];
    if (mostraCardapio) {
      // Opções de cardápio ativas, na ordem do catálogo do app (seções e itens ativos)
      const { rows } = await db.query<{ opcao_id: string; opcao: string; descricao: string | null; titulo: string; escolha: number | null; nome: string; restricoes: string[] }>(
        `SELECT o.id AS opcao_id, o.nome AS opcao, o.descricao, coalesce(os.titulo, cs.nome) AS titulo, os.escolha_qtd AS escolha,
                ci.nome, ci.restricoes
           FROM cardapio_opcoes o
           JOIN cardapio_opcao_secoes os ON os.opcao_id = o.id
           JOIN catalogo_secoes cs ON cs.id = os.secao_id
           JOIN cardapio_opcao_itens oi ON oi.opcao_secao_id = os.id
           JOIN catalogo_itens ci ON ci.id = oi.item_id AND ci.ativo
          WHERE o.tenant_id = $1 AND o.ativo
          ORDER BY o.nome, o.id, os.ordem, oi.ordem`,
        [base.tenantId]
      );
      for (const r of rows) {
        let op = cardapios.find((c) => c.id === r.opcao_id);
        if (!op) cardapios.push((op = { id: r.opcao_id, nome: r.opcao, descricao: r.descricao, secoes: [] }));
        let sec = op.secoes.find((x) => x.titulo === r.titulo);
        if (!sec) op.secoes.push((sec = { titulo: r.titulo, escolha: r.escolha, itens: [] }));
        sec.itens.push({ nome: r.nome, restricoes: r.restricoes ?? [] });
      }
    }
    const datasOcupadas = ocupadas.rows.map((r) => r.d);
    const distribuicao = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as PerfilCompleto['distribuicao'];
    for (const d of dist.rows) distribuicao[d.nota as 1 | 2 | 3 | 4 | 5] = Number(d.n);
    return {
      ...base, id: p.id, selo: p.selo === true, usaAgenda, mostraCardapio, logradouro: p.logradouro, numero: p.numero,
      aceita_menor: p.aceita_menor, cidadesAtendidas: p.cidades,
      avaliacoes: avs.rows, distribuicao, cardapios,
      disponibilidade: disponibilidade({ usaAgenda, ocupado: data != null && datasOcupadas.includes(data) }, data),
      datasOcupadas: usaAgenda ? datasOcupadas : [],
    };
  });
}

// ---------------------------------------------------------------------------
// Métricas (aparições nos resultados, visualizações do perfil, cliques em "Pedir orçamento")
// ---------------------------------------------------------------------------
const ROBO = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|preview|headless|lighthouse|curl|wget|python|httpie|go-http|java\//i;
export const ehRobo = (userAgent: string | null) => !userAgent || ROBO.test(userAgent);

/** Soma métricas do dia (fuso SP). Contador de sistema: nunca falha a página. */
export async function registrarMetrica(perfilIds: string[], campo: 'aparicoes' | 'visualizacoes' | 'cliques_orcamento', userAgent: string | null): Promise<void> {
  if (!perfilIds.length || ehRobo(userAgent)) return;
  try {
    await withSystem((db) =>
      db.query(
        `INSERT INTO busca_metricas_dia (tenant_id, perfil_id, dia, ${campo})
         SELECT p.tenant_id, p.id, (now() AT TIME ZONE 'America/Sao_Paulo')::date, 1 FROM busca_perfis p WHERE p.id = ANY($1::uuid[]) AND p.publicado
         ON CONFLICT (perfil_id, dia) DO UPDATE SET ${campo} = busca_metricas_dia.${campo} + 1`,
        [perfilIds]
      )
    );
  } catch (err) {
    console.error('[busca] métrica:', err);
  }
}

/** Tipos de evento com pelo menos um buffet publicado em cada cidade (landings e links internos). */
export async function combinacoesLanding(limite = 500): Promise<{ tipo: string; cidade: Cidade; total: number }[]> {
  return leituraPublica(async (db) => {
    const { rows } = await db.query(
      `SELECT x.tipo, c.id, c.nome, c.uf, c.slug, c.lat, c.lng, count(*) AS total
         FROM (SELECT unnest(p.tipos_evento) AS tipo, p.cidade_id FROM busca_perfis p JOIN tenants t ON t.id = p.tenant_id WHERE ${PERFIL_VISIVEL}) x
         JOIN busca_cidades c ON c.id = x.cidade_id
        GROUP BY x.tipo, c.id ORDER BY total DESC, c.nome LIMIT $1`,
      [limite]
    );
    return rows.map((r) => ({ tipo: r.tipo, cidade: { id: r.id, nome: r.nome, uf: r.uf, slug: r.slug, lat: r.lat, lng: r.lng }, total: Number(r.total) }));
  });
}


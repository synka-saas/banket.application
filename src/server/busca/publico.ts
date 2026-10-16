// Leituras públicas do Banket Busca (vitrine): cruzam empresas, então rodam na conexão de sistema, sempre numa
// transação READ ONLY e sempre filtrando perfis publicados de empresas ativas. É o ÚNICO módulo do Busca que lê
// sem RLS; só colunas públicas saem daqui. Escritas da vitrine (pedido, avaliação, métricas) entram por withTenant.
import { withSystem, type Db } from '../../lib/db';
import { slugTexto } from '../../lib/busca/geo';
import { urlMidia } from './perfil';

export interface Cidade {
  id: number;
  nome: string;
  uf: string;
  slug: string;
  lat: number;
  lng: number;
}

/** Transação somente leitura na conexão de sistema. */
export function leituraPublica<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return withSystem(async (db) => {
    await db.query('SET TRANSACTION READ ONLY');
    return fn(db);
  });
}

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
  pacotes: { nome: string; descricao: string | null; inclui: string[]; preco_pessoa: number | null; convidados_min: number | null; convidados_max: number | null; cardapio_opcao_id: string | null }[];
  atualizado_em: Date;
}

/** Perfil publicado pelo slug (null se não existe, não publicado ou empresa suspensa). Detalhes completos na fase 3. */
export async function perfilPublico(slug: string): Promise<PerfilPublico | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  return leituraPublica(async (db) => {
    const { rows } = await db.query(
      `SELECT p.id, p.tenant_id, p.slug, p.nome, p.descricao, p.logo_path, c.nome AS cidade, c.uf, p.bairro,
              p.tipos_evento, p.tipos_servico, p.restricoes, p.atende_domicilio, p.raio_km, p.espaco_proprio,
              p.capacidade_min, p.capacidade_max, p.nivel, p.nota_media, p.total_avaliacoes, p.tempo_resposta_texto,
              p.instagram, p.site, p.updated_at
         FROM busca_perfis p JOIN tenants t ON t.id = p.tenant_id LEFT JOIN busca_cidades c ON c.id = p.cidade_id
        WHERE p.slug = $1 AND ${PERFIL_VISIVEL}`,
      [slug]
    );
    const p = rows[0];
    if (!p) return null;
    const [fotos, pacotes] = await Promise.all([
      db.query(`SELECT path, legenda, tags FROM busca_fotos WHERE perfil_id = $1 AND bloqueado_plano_em IS NULL ORDER BY capa DESC, ordem, created_at`, [p.id]),
      db.query(
        `SELECT nome, descricao, inclui, preco_pessoa, convidados_min, convidados_max, cardapio_opcao_id
           FROM busca_pacotes WHERE perfil_id = $1 AND ativo ORDER BY ordem, preco_pessoa NULLS LAST`,
        [p.id]
      ),
    ]);
    return {
      tenantId: p.tenant_id, slug: p.slug, nome: p.nome, descricao: p.descricao, logo: urlMidia(p.tenant_id, p.logo_path),
      cidade: p.cidade, uf: p.uf, bairro: p.bairro, tipos_evento: p.tipos_evento, tipos_servico: p.tipos_servico,
      restricoes: p.restricoes, atende_domicilio: p.atende_domicilio, raio_km: p.raio_km, espaco_proprio: p.espaco_proprio,
      capacidade_min: p.capacidade_min, capacidade_max: p.capacidade_max, nivel: p.nivel, nota_media: p.nota_media,
      total_avaliacoes: p.total_avaliacoes, tempo_resposta_texto: p.tempo_resposta_texto, instagram: p.instagram, site: p.site,
      fotos: fotos.rows.map((f) => ({ url: urlMidia(p.tenant_id, f.path)!, legenda: f.legenda, tags: f.tags })),
      pacotes: pacotes.rows,
      atualizado_em: p.updated_at,
    };
  });
}

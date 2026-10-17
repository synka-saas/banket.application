// Perfil do buffet no Banket Busca (1 por empresa). Fase 2: criação com pré-preenchimento a partir da empresa e do
// espaço padrão, nível (gratuito/cliente) sincronizado com o plano, excedentes do plano gratuito e URLs das fotos.
// O onboarding e a edição chegam na fase 4. Recebe `db` dentro de withTenant (RLS da própria empresa).
import { systemQuery, type Db } from '../../lib/db';
import { ARQUIVO_FOTO_PADRAO, FOTO_PADRAO } from '../../lib/busca/url';
import { randomUUID } from 'node:crypto';
import { entitlements, limiteEm, nivelEm, podeUsarEm } from '../../lib/planos/gating';

export interface PerfilBusca {
  id: string;
  tenant_id: string;
  /** Endereço público (/buffet/<slug>): o próprio id por padrão; endereço escolhido só com o recurso busca_slug */
  slug: string;
  /** Endereços anteriores: redirecionam (301) para o atual */
  slugs_antigos: string[];
  nome: string;
  documento: string | null;
  descricao: string | null;
  logo_path: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email_contato: string | null;
  instagram: string | null;
  site: string | null;
  tipos_evento: string[];
  tipos_servico: string[];
  restricoes: string[];
  atende_domicilio: boolean;
  raio_km: number | null;
  espaco_proprio: boolean;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade_id: number | null;
  lat: number | null;
  lng: number | null;
  capacidade_min: number | null;
  capacidade_max: number | null;
  aceita_menor: boolean;
  valor_minimo: number | null;
  tempo_resposta_texto: string | null;
  etapa_concluida: number;
  publicado: boolean;
  publicado_em: Date | null;
  completude: number;
  nivel: 'gratuito' | 'cliente';
  nota_media: number | null;
  total_avaliacoes: number;
  taxa_resposta: number | null;
  sincronizar_agenda: boolean;
  excedentes: { tipos_evento?: string[]; tipos_servico?: string[] };
  updated_at: Date;
}

export async function carregarPerfil(db: Db): Promise<PerfilBusca | null> {
  const { rows } = await db.query<PerfilBusca>('SELECT * FROM busca_perfis LIMIT 1');
  return rows[0] ?? null;
}

/**
 * O endereço está livre no Busca inteiro? Não pode ser o endereço atual nem um endereço antigo de outro perfil (os
 * antigos continuam redirecionando). Conexão de sistema: a RLS esconde os perfis das outras empresas.
 */
export async function slugLivre(slug: string, perfilId: string): Promise<boolean> {
  const { rows } = await systemQuery(
    'SELECT 1 FROM busca_perfis WHERE id <> $2 AND (slug = $1 OR $1 = ANY(slugs_antigos)) LIMIT 1',
    [slug, perfilId]
  );
  return rows.length === 0;
}

/** Perfil da empresa; cria o rascunho (não publicado) com os dados da empresa e do espaço padrão na primeira vez. */
export async function garantirPerfil(db: Db, tenantId: string): Promise<PerfilBusca> {
  const atual = await carregarPerfil(db);
  if (atual) return atual;
  const { rows: t } = await db.query<{ nome: string; documento: string | null; email: string | null; telefone: string | null; logo_path: string | null }>(
    'SELECT nome, documento, email, telefone, logo_path FROM tenants WHERE id = $1',
    [tenantId]
  );
  if (!t[0]) throw new Error('Empresa não encontrada.');
  // Espaço próprio padrão (clientes Banket): capacidade e indicação de espaço próprio
  const { rows: esp } = await db.query<{ capacidade_min: number | null; capacidade_max: number | null }>(
    `SELECT e.capacidade_min, e.capacidade_max FROM espacos e
       LEFT JOIN configuracoes_tenant c ON c.espaco_padrao_id = e.id
      WHERE e.tipo = 'proprio' AND e.ativo ORDER BY (c.tenant_id IS NOT NULL) DESC, e.ordem LIMIT 1`
  );
  const ent = await entitlements(tenantId, db);
  // O endereço nasce como o próprio id do perfil; planos pagos podem trocar por um nome na etapa 1
  const id = randomUUID();
  const min = esp[0]?.capacidade_min ?? null;
  const max = esp[0]?.capacidade_max ?? null;
  const { rows } = await db.query<PerfilBusca>(
    `INSERT INTO busca_perfis (id, tenant_id, slug, nome, documento, email_contato, telefone, logo_path, espaco_proprio,
                               capacidade_min, capacidade_max, nivel)
     VALUES ($12, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (tenant_id) DO UPDATE SET updated_at = busca_perfis.updated_at
     RETURNING *`,
    [tenantId, id, t[0].nome, t[0].documento, t[0].email, t[0].telefone, t[0].logo_path, Boolean(esp[0]),
     min, max != null && min != null && max < min ? min : max, nivelEm(ent), id]
  );
  return rows[0];
}

/** Nível do perfil acompanha o plano (ranking e selo leem a coluna). Chamado por server/planos.trocarPlano. */
export async function sincronizarNivel(db: Db, tenantId: string, nivel: 'gratuito' | 'cliente'): Promise<void> {
  await db.query('UPDATE busca_perfis SET nivel = $2, updated_at = now() WHERE tenant_id = $1 AND nivel <> $2', [tenantId, nivel]);
}

/**
 * Excedentes do plano no perfil (rebaixamento): fotos além do limite ficam fora do perfil público (mantém a capa e a
 * ordem), tipos de evento e de serviço além do limite saem dos arrays e ficam guardados em `excedentes`. Nada é apagado.
 */
export async function aplicarExcedentesBusca(db: Db, tenantId: string): Promise<void> {
  const ent = await entitlements(tenantId, db);
  // Endereço próprio é recurso pago: sem ele, volta para o id do perfil (o antigo segue redirecionando)
  if (!podeUsarEm(ent, 'busca_slug')) {
    await db.query(
      `UPDATE busca_perfis
          SET slugs_antigos = CASE WHEN slug = ANY(slugs_antigos) THEN slugs_antigos ELSE array_append(slugs_antigos, slug) END,
              slug = id::text, updated_at = now()
        WHERE tenant_id = $1 AND slug <> id::text`,
      [tenantId]
    );
  }
  const maxFotos = limiteEm(ent, 'busca_fotos');
  if (Number.isFinite(maxFotos)) {
    await db.query(
      `WITH ordenadas AS (
         SELECT id, row_number() OVER (ORDER BY capa DESC, ordem, created_at) AS n FROM busca_fotos WHERE tenant_id = $1
       )
       UPDATE busca_fotos f SET bloqueado_plano_em = CASE WHEN o.n > $2 THEN COALESCE(f.bloqueado_plano_em, now()) ELSE NULL END
         FROM ordenadas o WHERE o.id = f.id`,
      [tenantId, maxFotos]
    );
  }
  const { rows } = await db.query<{ tipos_evento: string[]; tipos_servico: string[]; excedentes: PerfilBusca['excedentes'] }>(
    'SELECT tipos_evento, tipos_servico, excedentes FROM busca_perfis WHERE tenant_id = $1 FOR UPDATE',
    [tenantId]
  );
  if (!rows[0]) return;
  const cortar = (lista: string[], guardados: string[] | undefined, max: number) => {
    const todos = [...lista, ...(guardados ?? []).filter((s) => !lista.includes(s))];
    return Number.isFinite(max) ? { ficam: todos.slice(0, max), saem: todos.slice(max) } : { ficam: todos, saem: [] };
  };
  const ev = cortar(rows[0].tipos_evento, rows[0].excedentes?.tipos_evento, limiteEm(ent, 'busca_tipos_evento'));
  const sv = cortar(rows[0].tipos_servico, rows[0].excedentes?.tipos_servico, limiteEm(ent, 'busca_tipos_servico'));
  await db.query(
    `UPDATE busca_perfis SET tipos_evento = $2, tipos_servico = $3, excedentes = $4::jsonb, updated_at = now() WHERE tenant_id = $1`,
    [tenantId, ev.ficam, sv.ficam, JSON.stringify({ tipos_evento: ev.saem, tipos_servico: sv.saem })]
  );
}

/** URL pública de uma foto ou logo do perfil: estáticos (seed) começam com "/"; o resto vem do storage. */
export function urlMidia(tenantId: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (path === ARQUIVO_FOTO_PADRAO) return FOTO_PADRAO;
  if (path.startsWith('/')) return path;
  return `/busca-media/${tenantId}/${path}`;
}

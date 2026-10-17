// Onboarding e edição do perfil no Banket Busca (fase 4, PLANO.md §7). Cada etapa valida com zod e grava no perfil
// da própria empresa (withTenant). Depois de toda gravação: completude e etapa_concluida recalculadas; perfil publicado
// que deixa de cumprir as etapas 1–5 volta a rascunho. Limites do plano (tipos, fotos, grupos de fotos) pelo gating
// central. Sem pacotes nem preço (16/10/2026); a tabela busca_pacotes fica sem uso.
import { z } from 'zod';
import type { Db } from '../../lib/db';
import { isAdmin, type SessionUser } from '../../lib/auth';
import { UserError, checkbox, optionalInt, optionalText, requiredText } from '../../lib/forms';
import { cnpjValido, cpfValido, somenteDigitos } from '../../lib/documento';
import { RESTRICOES, TIPOS_EVENTO, TIPOS_SERVICO, filtrarSlugs } from '../../lib/busca/catalogos';
import { cepValido } from '../../lib/busca/geo';
import { ETAPAS_PARA_PUBLICAR, ETAPA_REVISAO, completude, ehUuid, etapasConcluidas, normalizarSlug, podePublicar, pendentesParaPublicar, problemaNoSlug, type Contagens } from '../../lib/busca/onboarding';
import { ErroPlano, entitlements, exigir, limite, podeUsar } from '../../lib/planos/gating';
import { copiarArquivo, removeFile, saveUpload } from '../../lib/storage';
import { garantirPerfil, slugLivre, type PerfilBusca } from './perfil';

export const TIPOS_FOTO = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FOTO_BYTES = 8 * 1024 * 1024;

function exigirEditor(user: SessionUser) {
  if (!isAdmin(user)) throw new UserError('Só proprietários e administradores podem editar o perfil no Banket Busca.');
}

export async function contagens(db: Db, perfilId: string): Promise<Contagens> {
  const { rows } = await db.query<{ fotos: number }>(
    'SELECT count(*) AS fotos FROM busca_fotos WHERE perfil_id = $1 AND bloqueado_plano_em IS NULL',
    [perfilId]
  );
  return { fotos: Number(rows[0].fotos) };
}

/**
 * Recalcula completude e etapa concluída; despublica se faltar alguma etapa. Devolve se foi despublicado.
 * Exceção: perfil vindo da importação (busca_importacao) continua publicado enquanto o dono completa as informações
 * (decisão de 17/10/2026); a completude pesa só no ranking. Se o dono despublicar, as regras valem para publicar de novo.
 */
export async function recalcular(db: Db, perfilId: string): Promise<{ despublicado: boolean }> {
  const { rows } = await db.query<PerfilBusca & { importado: boolean }>(
    'SELECT p.*, EXISTS (SELECT 1 FROM busca_importacao i WHERE i.perfil_id = p.id) AS importado FROM busca_perfis p WHERE p.id = $1',
    [perfilId]
  );
  const p = rows[0];
  const c = await contagens(db, perfilId);
  const ok = etapasConcluidas(p, c);
  let maior = 0;
  for (let n = 1; n <= ETAPAS_PARA_PUBLICAR && ok.has(n); n++) maior = n;
  const despublicar = p.publicado && !p.importado && !podePublicar(p, c);
  await db.query(
    `UPDATE busca_perfis SET completude = $2, etapa_concluida = $3, publicado = publicado AND NOT $4, updated_at = now() WHERE id = $1`,
    [perfilId, completude(p, c), despublicar ? maior : p.publicado ? ETAPA_REVISAO : maior, despublicar]
  );
  return { despublicado: despublicar };
}

// ---------------------------------------------------------------------------
// Etapas 1 a 4
// ---------------------------------------------------------------------------
/**
 * Etapa 1 só com o que é do perfil público: redes, tempo de resposta, descrição e o endereço do perfil. Os dados da
 * empresa (nome, CNPJ/CPF, e-mail, telefone/WhatsApp, logotipo) vêm de Configurações › Empresa
 * (sincronizarPerfisComEmpresa) e não são pedidos de novo.
 */
export const empresaSchema = z.object({
  instagram: optionalText(120),
  site: optionalText(255),
  tempo_resposta_texto: optionalText(60),
  descricao: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().min(80, 'Escreva ao menos 80 caracteres na descrição.').max(1200, 'A descrição pode ter até 1.200 caracteres.')),
  // Endereço do perfil (só planos pagos mostram o campo): ausente = não mexe; vazio = volta para o id do perfil
  endereco: z.preprocess((v) => (typeof v === 'string' ? normalizarSlug(v) : undefined), z.string().optional()),
});

export async function salvarEmpresa(db: Db, user: SessionUser, input: z.infer<typeof empresaSchema>) {
  exigirEditor(user);
  const p = await garantirPerfil(db, user.tenantId);
  await salvarEndereco(db, user.tenantId, p, input.endereco);
  const instagram = input.instagram ? (input.instagram.startsWith('@') || input.instagram.includes('/') ? input.instagram : `@${input.instagram}`) : null;
  await db.query(
    `UPDATE busca_perfis SET instagram = $2, site = $3, tempo_resposta_texto = $4, descricao = $5, updated_at = now() WHERE id = $1`,
    [p.id, instagram, input.site, input.tempo_resposta_texto, input.descricao]
  );
  await sincronizarPerfisComEmpresa(db, user.tenantId);
  return recalcular(db, p.id);
}

/** Dados da empresa (Configurações › Empresa) que o perfil do Busca usa. */
export interface DadosEmpresa {
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  logo_path: string | null;
}

export async function dadosDaEmpresa(db: Db, tenantId: string): Promise<DadosEmpresa | null> {
  const { rows } = await db.query<DadosEmpresa>('SELECT nome, documento, email, telefone, logo_path FROM tenants WHERE id = $1', [tenantId]);
  return rows[0] ?? null;
}

/** O que falta no cadastro da empresa para concluir a etapa 1 (o perfil exige CNPJ/CPF, e-mail e telefone). */
export function faltasDaEmpresa(e: DadosEmpresa | null): string[] {
  if (!e) return ['dados da empresa'];
  const doc = e.documento ? somenteDigitos(e.documento) : '';
  const falta: string[] = [];
  if (!(doc.length === 14 ? cnpjValido(doc) : doc.length === 11 ? cpfValido(doc) : false)) falta.push('CNPJ ou CPF');
  if (!e.email?.trim()) falta.push('e-mail');
  const fone = e.telefone ? somenteDigitos(e.telefone) : '';
  if (fone.length < 10) falta.push('telefone ou WhatsApp');
  return falta;
}

/**
 * Copia o cadastro da empresa para os perfis do Busca: CNPJ/CPF, e-mail, telefone (celular vira o WhatsApp; fixo,
 * o telefone) e o logotipo (copiado para a pasta do Busca, que só serve PNG/JPG/WebP). O nome vai só quando a empresa
 * tem um perfil (com várias unidades, cada perfil tem o nome da unidade). `logoAlterado`: o logo da empresa mudou
 * (novo ou removido); sem isso, o logo só é copiado para perfis ainda sem logo do Busca.
 */
export async function sincronizarPerfisComEmpresa(db: Db, tenantId: string, opcoes: { logoAlterado?: boolean } = {}): Promise<void> {
  const e = await dadosDaEmpresa(db, tenantId);
  if (!e) return;
  const { rows: perfis } = await db.query<{ id: string; logo_path: string | null }>('SELECT id, logo_path FROM busca_perfis WHERE tenant_id = $1', [tenantId]);
  if (!perfis.length) return;
  const fone = e.telefone ? somenteDigitos(e.telefone) : '';
  const doc = e.documento ? somenteDigitos(e.documento) : null;
  const logoValido = e.logo_path && /\.(png|jpe?g|webp)$/i.test(e.logo_path) ? e.logo_path : null;
  let logoCopiado: string | null | undefined;
  for (const p of perfis) {
    let logo = p.logo_path;
    const doBusca = Boolean(p.logo_path?.startsWith('busca/'));
    if (opcoes.logoAlterado || !doBusca) {
      if (logoCopiado === undefined) logoCopiado = logoValido ? await copiarArquivo(tenantId, logoValido, 'busca').catch(() => null) : null;
      logo = logoCopiado;
    }
    await db.query(
      `UPDATE busca_perfis SET documento = $2, email_contato = $3, whatsapp = $4, telefone = $5, logo_path = $6,
              nome = CASE WHEN $7 THEN $8 ELSE nome END, updated_at = now()
        WHERE id = $1`,
      [p.id, doc, e.email?.trim().toLowerCase() || null, fone.length === 11 ? fone : null, fone.length === 10 ? fone : null, logo,
       perfis.length === 1, e.nome]
    );
    if (doBusca && p.logo_path !== logo) await removeFile(tenantId, p.logo_path!).catch(() => undefined);
    await recalcular(db, p.id);
  }
}

/**
 * Troca o endereço público do perfil. Endereço próprio exige o recurso busca_slug (planos pagos) e não pode estar em
 * uso por outro perfil, nem como endereço antigo. O endereço anterior vai para slugs_antigos e redireciona (o id do
 * perfil sempre resolve, então não precisa ser guardado).
 */
async function salvarEndereco(db: Db, tenantId: string, p: PerfilBusca, endereco: string | undefined) {
  if (endereco === undefined) return;
  const novo = endereco || p.id;
  if (novo === p.slug) return;
  if (novo !== p.id) {
    await exigir(tenantId, 'busca_slug', 'Endereço personalizado do perfil');
    const problema = problemaNoSlug(novo);
    if (problema) throw new UserError(problema, 'endereco');
    if (!(await slugLivre(novo, p.id))) throw new UserError('Esse endereço já está em uso. Escolha outro.', 'endereco');
  }
  const antigos = [...new Set([...(p.slugs_antigos ?? []), ...(ehUuid(p.slug) ? [] : [p.slug])])].filter((x) => x !== novo);
  await db.query('UPDATE busca_perfis SET slug = $2, slugs_antigos = $3, updated_at = now() WHERE id = $1', [p.id, novo, antigos]);
}

export const eventosSchema = z.object({
  tipos_evento: z.preprocess((v) => filtrarSlugs(v, TIPOS_EVENTO), z.array(z.string()).min(1, 'Escolha ao menos um tipo de evento.')),
  tipos_servico: z.preprocess((v) => filtrarSlugs(v, TIPOS_SERVICO), z.array(z.string()).min(1, 'Escolha ao menos um tipo de serviço.')),
  restricoes: z.preprocess((v) => filtrarSlugs(v, RESTRICOES), z.array(z.string())),
});

export async function salvarEventos(db: Db, user: SessionUser, input: z.infer<typeof eventosSchema>) {
  exigirEditor(user);
  for (const [recurso, lista, rotulo] of [
    ['busca_tipos_evento', input.tipos_evento, 'tipos de evento'],
    ['busca_tipos_servico', input.tipos_servico, 'tipos de serviço'],
  ] as const) {
    const max = await limite(user.tenantId, recurso);
    if (lista.length > max) throw new ErroPlano('LIMITE_DO_PLANO', recurso, `O seu plano permite até ${max} ${rotulo}. Desmarque alguns ou mude de plano.`, max, lista.length);
  }
  const p = await garantirPerfil(db, user.tenantId);
  await db.query(
    `UPDATE busca_perfis SET tipos_evento = $2, tipos_servico = $3, restricoes = $4, excedentes = excedentes - 'tipos_evento' - 'tipos_servico', updated_at = now() WHERE id = $1`,
    [p.id, input.tipos_evento, input.tipos_servico, input.restricoes]
  );
  return recalcular(db, p.id);
}

export const regiaoSchema = z
  .object({
    cidade: z.string({ error: 'Escolha a cidade.' }).regex(/^[a-z0-9-]{3,140}$/, 'Escolha a cidade na lista.'),
    espaco_proprio: checkbox(),
    cep: z.preprocess((v) => (typeof v === 'string' && v.trim() ? cepValido(v) ?? 'invalido' : null), z.string().regex(/^\d{8}$/, 'CEP inválido.').nullable()),
    logradouro: optionalText(255),
    numero: optionalText(20),
    bairro: optionalText(120),
    atende_domicilio: checkbox(),
    raio_km: optionalInt(),
    cidades: z.preprocess((v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []), z.array(z.string().regex(/^[a-z0-9-]{3,140}$/)).max(40)),
  })
  .superRefine((d, ctx) => {
    if (!d.espaco_proprio && !d.atende_domicilio) ctx.addIssue({ code: 'custom', message: 'Marque espaço próprio, atendimento em domicílio ou os dois.', path: ['espaco_proprio'] });
    if (d.espaco_proprio && !d.logradouro) ctx.addIssue({ code: 'custom', message: 'Informe o endereço do espaço.', path: ['logradouro'] });
    if (d.atende_domicilio && !(d.raio_km && d.raio_km >= 1 && d.raio_km <= 500)) ctx.addIssue({ code: 'custom', message: 'Escolha o raio de atendimento.', path: ['raio_km'] });
  });

export async function salvarRegiao(db: Db, user: SessionUser, input: z.infer<typeof regiaoSchema>) {
  exigirEditor(user);
  const p = await garantirPerfil(db, user.tenantId);
  const { rows: cid } = await db.query<{ id: number; lat: number; lng: number }>('SELECT id, lat, lng FROM busca_cidades WHERE slug = $1', [input.cidade]);
  if (!cid[0]) throw new UserError('Escolha a cidade na lista.', 'cidade');
  await db.query(
    `UPDATE busca_perfis SET cidade_id = $2, lat = $3, lng = $4, espaco_proprio = $5, cep = $6, logradouro = $7, numero = $8, bairro = $9,
            atende_domicilio = $10, raio_km = $11, updated_at = now() WHERE id = $1`,
    [p.id, cid[0].id, cid[0].lat, cid[0].lng, input.espaco_proprio, input.cep, input.espaco_proprio ? input.logradouro : null,
     input.espaco_proprio ? input.numero : null, input.bairro, input.atende_domicilio, input.atende_domicilio ? input.raio_km : null]
  );
  await db.query('DELETE FROM busca_perfil_cidades WHERE perfil_id = $1', [p.id]);
  const extras = [...new Set(input.cidades)].filter((s) => s !== input.cidade);
  if (extras.length) {
    await db.query(
      `INSERT INTO busca_perfil_cidades (tenant_id, perfil_id, cidade_id)
       SELECT $1, $2, id FROM busca_cidades WHERE slug = ANY($3::text[]) ON CONFLICT DO NOTHING`,
      [user.tenantId, p.id, extras]
    );
  }
  return recalcular(db, p.id);
}

export const capacidadeSchema = z
  .object({
    capacidade_min: z.preprocess((v) => (v === '' || v == null ? undefined : Number(String(v).replace(/\D/g, ''))), z.number({ error: 'Informe o mínimo de convidados.' }).int().min(1, 'O mínimo é 1 convidado.').max(5000)),
    capacidade_max: z.preprocess((v) => (v === '' || v == null ? undefined : Number(String(v).replace(/\D/g, ''))), z.number({ error: 'Informe o máximo de convidados.' }).int().min(1).max(5000, 'O máximo é 5.000 convidados.')),
    aceita_menor: checkbox(),
  })
  .refine((d) => d.capacidade_min <= d.capacidade_max, { message: 'O mínimo não pode passar do máximo.', path: ['capacidade_max'] });

export async function salvarCapacidade(db: Db, user: SessionUser, input: z.infer<typeof capacidadeSchema>) {
  exigirEditor(user);
  const p = await garantirPerfil(db, user.tenantId);
  await db.query(
    `UPDATE busca_perfis SET capacidade_min = $2, capacidade_max = $3, aceita_menor = $4, valor_minimo = NULL, updated_at = now() WHERE id = $1`,
    [p.id, input.capacidade_min, input.capacidade_max, input.aceita_menor]
  );
  return recalcular(db, p.id);
}

// ---------------------------------------------------------------------------
// Etapa 5: fotos (grupos = tags, só nos planos pagos: fotos de eventos diferentes)
// ---------------------------------------------------------------------------
export interface Foto {
  id: string;
  path: string;
  legenda: string | null;
  tags: string[];
  ordem: number;
  capa: boolean;
  bloqueado_plano_em: Date | null;
}

export async function listarFotos(db: Db, perfilId: string): Promise<Foto[]> {
  const { rows } = await db.query<Foto>(
    `SELECT id, path, legenda, tags, ordem, capa, bloqueado_plano_em FROM busca_fotos WHERE perfil_id = $1
      ORDER BY bloqueado_plano_em NULLS FIRST, capa DESC, ordem, created_at`,
    [perfilId]
  );
  return rows;
}

/** Envia fotos novas até o limite do plano (as que excederem são recusadas com ErroPlano antes de gravar). `grupo`
 * (planos pagos): todas as fotos do envio entram no mesmo grupo, ex.: "Casamento Ana e Pedro". */
export async function adicionarFotos(db: Db, user: SessionUser, arquivos: File[], grupo: string | null = null) {
  exigirEditor(user);
  const lista = arquivos.filter((f) => f && f.size > 0);
  if (!lista.length) throw new UserError('Escolha ao menos uma foto.', 'fotos');
  const tags = grupoParaTags(grupo);
  if (tags.length) await exigir(user.tenantId, 'busca_fotos_tags', 'Grupos de fotos');
  const p = await garantirPerfil(db, user.tenantId);
  const { fotos } = await contagens(db, p.id);
  const max = await limite(user.tenantId, 'busca_fotos');
  if (fotos + lista.length > max) {
    throw new ErroPlano('LIMITE_DO_PLANO', 'busca_fotos', `O seu plano permite até ${max} fotos (você tem ${fotos}). Para enviar mais, mude de plano.`, max, fotos);
  }
  const { rows: o } = await db.query<{ n: number; capa: boolean }>('SELECT coalesce(max(ordem), 0) AS n, bool_or(capa) AS capa FROM busca_fotos WHERE perfil_id = $1', [p.id]);
  let ordem = Number(o[0]?.n ?? 0);
  let temCapa = o[0]?.capa === true;
  for (const f of lista) {
    const path = await saveUpload(user.tenantId, 'busca', f, { allowedTypes: TIPOS_FOTO, maxBytes: MAX_FOTO_BYTES }).catch((e: Error) => {
      throw new UserError(e.message === 'Tipo de arquivo não permitido.' ? 'As fotos precisam ser JPG, PNG ou WebP.' : e.message, 'fotos');
    });
    ordem++;
    await db.query(
      `INSERT INTO busca_fotos (tenant_id, perfil_id, path, ordem, capa, tags) VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.tenantId, p.id, path, ordem, !temCapa, tags]
    );
    temCapa = true;
  }
  return recalcular(db, p.id);
}

/** Grupos digitados ("Casamento Ana, Coffee break") → tags: sem repetição (sem diferenciar maiúsculas), até 8 de 40. */
export function grupoParaTags(v: unknown): string[] {
  if (typeof v !== 'string') return [];
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const t of v.split(',').map((s) => s.trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean)) {
    const k = t.toLocaleLowerCase('pt-BR');
    if (!vistos.has(k)) { vistos.add(k); out.push(t); }
  }
  return out.slice(0, 8);
}

export const fotoSchema = z.object({
  legenda: optionalText(160),
  tags: z.preprocess(grupoParaTags, z.array(z.string())),
});

export async function salvarFoto(db: Db, user: SessionUser, id: string, input: z.infer<typeof fotoSchema>) {
  exigirEditor(user);
  if (input.tags.length) await exigir(user.tenantId, 'busca_fotos_tags', 'Grupos de fotos');
  const p = await garantirPerfil(db, user.tenantId);
  await db.query('UPDATE busca_fotos SET legenda = $1, tags = $2 WHERE id = $3 AND perfil_id = $4', [input.legenda, input.tags, id, p.id]);
}

export async function definirCapa(db: Db, user: SessionUser, id: string) {
  exigirEditor(user);
  const p = await garantirPerfil(db, user.tenantId);
  const { rows } = await db.query('SELECT 1 FROM busca_fotos WHERE id = $1 AND perfil_id = $2 AND bloqueado_plano_em IS NULL', [id, p.id]);
  if (!rows.length) throw new UserError('Foto não encontrada.');
  await db.query('UPDATE busca_fotos SET capa = (id = $1) WHERE perfil_id = $2', [id, p.id]);
}

export async function moverFoto(db: Db, user: SessionUser, id: string, direcao: 'antes' | 'depois') {
  exigirEditor(user);
  const p = await garantirPerfil(db, user.tenantId);
  const fotos = (await listarFotos(db, p.id)).filter((f) => !f.bloqueado_plano_em && !f.capa);
  const i = fotos.findIndex((f) => f.id === id);
  const j = direcao === 'antes' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= fotos.length) return;
  [fotos[i], fotos[j]] = [fotos[j], fotos[i]];
  for (const [k, f] of fotos.entries()) await db.query('UPDATE busca_fotos SET ordem = $1 WHERE id = $2', [k + 1, f.id]);
}

export async function excluirFoto(db: Db, user: SessionUser, id: string) {
  exigirEditor(user);
  const p = await garantirPerfil(db, user.tenantId);
  const { rows } = await db.query<{ path: string; capa: boolean }>('DELETE FROM busca_fotos WHERE id = $1 AND perfil_id = $2 RETURNING path, capa', [id, p.id]);
  if (rows[0]?.path.startsWith('busca/')) await removeFile(user.tenantId, rows[0].path).catch(() => undefined);
  if (rows[0]?.capa) {
    await db.query(
      `UPDATE busca_fotos SET capa = true WHERE id = (SELECT id FROM busca_fotos WHERE perfil_id = $1 AND bloqueado_plano_em IS NULL ORDER BY ordem LIMIT 1)`,
      [p.id]
    );
  }
  return recalcular(db, p.id);
}

// ---------------------------------------------------------------------------
// Etapa 6: publicação
// ---------------------------------------------------------------------------
export async function publicar(db: Db, user: SessionUser, aceite: boolean) {
  exigirEditor(user);
  if (!aceite) throw new UserError('Aceite os termos de uso para buffets para publicar.', 'aceite');
  const p = await garantirPerfil(db, user.tenantId);
  const c = await contagens(db, p.id);
  const faltam = pendentesParaPublicar(p, c);
  if (faltam.length) throw new UserError(`Para publicar, conclua: ${faltam.map((e) => e.titulo.toLowerCase()).join(', ')}.`);
  await db.query(`UPDATE busca_perfis SET publicado = true, publicado_em = coalesce(publicado_em, now()), etapa_concluida = $2, updated_at = now() WHERE id = $1`, [p.id, ETAPA_REVISAO]);
  await recalcular(db, p.id);
}

export async function despublicar(db: Db, user: SessionUser) {
  exigirEditor(user);
  const p = await garantirPerfil(db, user.tenantId);
  await db.query('UPDATE busca_perfis SET publicado = false, updated_at = now() WHERE id = $1', [p.id]);
  await recalcular(db, p.id);
}

/** Recursos do plano que a interface do onboarding precisa (espelho; a regra vale no servidor). */
export async function recursosOnboarding(tenantId: string) {
  const [maxEventos, maxServicos, maxFotos, tags, cardapios, agenda, endereco] = await Promise.all([
    limite(tenantId, 'busca_tipos_evento'), limite(tenantId, 'busca_tipos_servico'), limite(tenantId, 'busca_fotos'),
    podeUsar(tenantId, 'busca_fotos_tags'), podeUsar(tenantId, 'busca_cardapios'), podeUsar(tenantId, 'busca_disponibilidade'),
    podeUsar(tenantId, 'busca_slug'),
  ]);
  return { maxEventos, maxServicos, maxFotos, tags, cardapios, agenda, endereco };
}

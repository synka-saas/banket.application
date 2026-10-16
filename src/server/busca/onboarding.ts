// Onboarding e edição do perfil no Banket Busca (fase 4, PLANO.md §7). Cada etapa valida com zod e grava no perfil
// da própria empresa (withTenant). Depois de toda gravação: completude e etapa_concluida recalculadas; perfil publicado
// que deixa de cumprir as etapas 1–6 volta a rascunho. Limites do plano (tipos, fotos, tags) pelo gating central.
import { z } from 'zod';
import type { Db } from '../../lib/db';
import { isAdmin, type SessionUser } from '../../lib/auth';
import { UserError, checkbox, optionalEmail, optionalInt, optionalMoney, optionalText, requiredText } from '../../lib/forms';
import { cnpjValido, cpfValido, somenteDigitos } from '../../lib/documento';
import { RESTRICOES, TIPOS_EVENTO, TIPOS_SERVICO, filtrarSlugs } from '../../lib/busca/catalogos';
import { cepValido } from '../../lib/busca/geo';
import { completude, etapasConcluidas, podePublicar, pendentesParaPublicar, type Contagens } from '../../lib/busca/onboarding';
import { ErroPlano, exigir, limite, podeUsar } from '../../lib/planos/gating';
import { removeFile, saveUpload } from '../../lib/storage';
import { garantirPerfil, type PerfilBusca } from './perfil';

export const TIPOS_FOTO = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FOTO_BYTES = 8 * 1024 * 1024;

function exigirEditor(user: SessionUser) {
  if (!isAdmin(user)) throw new UserError('Só proprietários e administradores podem editar o perfil no Banket Busca.');
}

export async function contagens(db: Db, perfilId: string): Promise<Contagens> {
  const { rows } = await db.query<{ pacotes: number; fotos: number }>(
    `SELECT (SELECT count(*) FROM busca_pacotes WHERE perfil_id = $1 AND ativo) AS pacotes,
            (SELECT count(*) FROM busca_fotos WHERE perfil_id = $1 AND bloqueado_plano_em IS NULL) AS fotos`,
    [perfilId]
  );
  return { pacotes: Number(rows[0].pacotes), fotos: Number(rows[0].fotos) };
}

/** Recalcula completude e etapa concluída; despublica se faltar alguma etapa. Devolve se foi despublicado. */
export async function recalcular(db: Db, perfilId: string): Promise<{ despublicado: boolean }> {
  const { rows } = await db.query<PerfilBusca>('SELECT * FROM busca_perfis WHERE id = $1', [perfilId]);
  const p = rows[0];
  const c = await contagens(db, perfilId);
  const ok = etapasConcluidas(p, c);
  let maior = 0;
  for (let n = 1; n <= 6 && ok.has(n); n++) maior = n;
  const despublicar = p.publicado && !podePublicar(p, c);
  await db.query(
    `UPDATE busca_perfis SET completude = $2, etapa_concluida = $3, publicado = publicado AND NOT $4, updated_at = now() WHERE id = $1`,
    [perfilId, completude(p, c), despublicar ? maior : p.publicado ? 7 : maior, despublicar]
  );
  return { despublicado: despublicar };
}

// ---------------------------------------------------------------------------
// Etapas 1 a 4
// ---------------------------------------------------------------------------
const telefone = () => z.preprocess((v) => (typeof v === 'string' && v.trim() ? somenteDigitos(v) : null), z.string().regex(/^\d{10,11}$/, 'Telefone inválido: informe DDD + número.').nullable());

export const empresaSchema = z
  .object({
    nome: requiredText('Informe o nome do buffet.', 120),
    documento: z.preprocess((v) => (typeof v === 'string' ? somenteDigitos(v) : ''), z.string()),
    whatsapp: telefone(),
    telefone: telefone(),
    email_contato: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.email('Informe um e-mail comercial válido.')),
    instagram: optionalText(120),
    site: optionalText(255),
    tempo_resposta_texto: optionalText(60),
    descricao: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().min(80, 'Escreva ao menos 80 caracteres na descrição.').max(1200, 'A descrição pode ter até 1.200 caracteres.')),
  })
  .superRefine((d, ctx) => {
    if (!(d.documento.length === 14 ? cnpjValido(d.documento) : d.documento.length === 11 ? cpfValido(d.documento) : false)) {
      ctx.addIssue({ code: 'custom', message: 'Informe um CNPJ (ou CPF) válido.', path: ['documento'] });
    }
    if (!d.whatsapp && !d.telefone) ctx.addIssue({ code: 'custom', message: 'Informe o WhatsApp ou um telefone.', path: ['whatsapp'] });
  });

export async function salvarEmpresa(db: Db, user: SessionUser, input: z.infer<typeof empresaSchema>, logo: File | null, removerLogo: boolean) {
  exigirEditor(user);
  const p = await garantirPerfil(db, user.tenantId);
  let logoPath = p.logo_path;
  if (logo && logo.size > 0) {
    logoPath = await saveUpload(user.tenantId, 'busca', logo, { allowedTypes: TIPOS_FOTO, maxBytes: 5 * 1024 * 1024 }).catch((e: Error) => {
      throw new UserError(e.message === 'Tipo de arquivo não permitido.' ? 'O logotipo precisa ser PNG, JPG ou WebP.' : e.message, 'logo');
    });
  } else if (removerLogo) {
    logoPath = null;
  }
  const instagram = input.instagram ? (input.instagram.startsWith('@') || input.instagram.includes('/') ? input.instagram : `@${input.instagram}`) : null;
  await db.query(
    `UPDATE busca_perfis SET nome = $2, documento = $3, whatsapp = $4, telefone = $5, email_contato = $6, instagram = $7, site = $8,
            tempo_resposta_texto = $9, descricao = $10, logo_path = $11, updated_at = now() WHERE id = $1`,
    [p.id, input.nome, input.documento, input.whatsapp, input.telefone, input.email_contato, instagram, input.site, input.tempo_resposta_texto, input.descricao, logoPath]
  );
  if (p.logo_path && p.logo_path !== logoPath && p.logo_path.startsWith('busca/')) await removeFile(user.tenantId, p.logo_path).catch(() => undefined);
  return recalcular(db, p.id);
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
    valor_minimo: optionalMoney(),
  })
  .refine((d) => d.capacidade_min <= d.capacidade_max, { message: 'O mínimo não pode passar do máximo.', path: ['capacidade_max'] });

export async function salvarCapacidade(db: Db, user: SessionUser, input: z.infer<typeof capacidadeSchema>) {
  exigirEditor(user);
  const p = await garantirPerfil(db, user.tenantId);
  await db.query(
    `UPDATE busca_perfis SET capacidade_min = $2, capacidade_max = $3, aceita_menor = $4, valor_minimo = $5, updated_at = now() WHERE id = $1`,
    [p.id, input.capacidade_min, input.capacidade_max, input.aceita_menor, input.aceita_menor ? input.valor_minimo : null]
  );
  return recalcular(db, p.id);
}

// ---------------------------------------------------------------------------
// Etapa 5: pacotes
// ---------------------------------------------------------------------------
export interface Pacote {
  id: string;
  nome: string;
  descricao: string | null;
  inclui: string[];
  preco_pessoa: number | null;
  convidados_min: number | null;
  convidados_max: number | null;
  cardapio_opcao_id: string | null;
  ativo: boolean;
  ordem: number;
}

export const pacoteSchema = z
  .object({
    nome: requiredText('Informe o nome do pacote.', 120),
    descricao: optionalText(600),
    inclui: z.preprocess((v) => (typeof v === 'string' ? v.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 12) : []), z.array(z.string().max(80, 'Cada item do "inclui" pode ter até 80 caracteres.'))),
    preco_pessoa: z.preprocess((v) => (v === '' || v == null ? undefined : v), optionalMoney().pipe(z.number({ error: 'Informe o preço por pessoa.' }).min(1, 'Informe o preço por pessoa.'))),
    convidados_min: optionalInt(),
    convidados_max: optionalInt(),
    ativo: checkbox(),
  })
  .refine((d) => d.convidados_min == null || d.convidados_max == null || d.convidados_min <= d.convidados_max, { message: 'O mínimo não pode passar do máximo.', path: ['convidados_max'] });

export async function listarPacotes(db: Db, perfilId: string): Promise<Pacote[]> {
  const { rows } = await db.query<Pacote>(
    `SELECT id, nome, descricao, inclui, preco_pessoa, convidados_min, convidados_max, cardapio_opcao_id, ativo, ordem
       FROM busca_pacotes WHERE perfil_id = $1 ORDER BY ordem, created_at`,
    [perfilId]
  );
  return rows;
}

export async function salvarPacote(db: Db, user: SessionUser, id: string | null, input: z.infer<typeof pacoteSchema>) {
  exigirEditor(user);
  const p = await garantirPerfil(db, user.tenantId);
  const valores = [input.nome, input.descricao, input.inclui, input.preco_pessoa, input.convidados_min, input.convidados_max, input.ativo];
  if (id) {
    const r = await db.query(
      `UPDATE busca_pacotes SET nome = $1, descricao = $2, inclui = $3, preco_pessoa = $4, convidados_min = $5, convidados_max = $6, ativo = $7, updated_at = now()
        WHERE id = $8 AND perfil_id = $9`,
      [...valores, id, p.id]
    );
    if (!r.rowCount) throw new UserError('Pacote não encontrado.');
  } else {
    await db.query(
      `INSERT INTO busca_pacotes (tenant_id, perfil_id, nome, descricao, inclui, preco_pessoa, convidados_min, convidados_max, ativo, ordem)
       VALUES ($8, $9, $1, $2, $3, $4, $5, $6, $7, (SELECT coalesce(max(ordem), 0) + 1 FROM busca_pacotes WHERE perfil_id = $9))`,
      [...valores, user.tenantId, p.id]
    );
  }
  return recalcular(db, p.id);
}

export async function excluirPacote(db: Db, user: SessionUser, id: string) {
  exigirEditor(user);
  const p = await garantirPerfil(db, user.tenantId);
  await db.query('DELETE FROM busca_pacotes WHERE id = $1 AND perfil_id = $2', [id, p.id]);
  return recalcular(db, p.id);
}

// ---------------------------------------------------------------------------
// Etapa 6: fotos
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

/** Envia fotos novas até o limite do plano (as que excederem são recusadas com ErroPlano antes de gravar). */
export async function adicionarFotos(db: Db, user: SessionUser, arquivos: File[]) {
  exigirEditor(user);
  const lista = arquivos.filter((f) => f && f.size > 0);
  if (!lista.length) throw new UserError('Escolha ao menos uma foto.', 'fotos');
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
      `INSERT INTO busca_fotos (tenant_id, perfil_id, path, ordem, capa) VALUES ($1, $2, $3, $4, $5)`,
      [user.tenantId, p.id, path, ordem, !temCapa]
    );
    temCapa = true;
  }
  return recalcular(db, p.id);
}

export const fotoSchema = z.object({
  legenda: optionalText(160),
  tags: z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 8) : []), z.array(z.string().max(30))),
});

export async function salvarFoto(db: Db, user: SessionUser, id: string, input: z.infer<typeof fotoSchema>) {
  exigirEditor(user);
  if (input.tags.length) await exigir(user.tenantId, 'busca_fotos_tags', 'Tags nas fotos');
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
// Etapa 7: publicação
// ---------------------------------------------------------------------------
export async function publicar(db: Db, user: SessionUser, aceite: boolean) {
  exigirEditor(user);
  if (!aceite) throw new UserError('Aceite os termos de uso para buffets para publicar.', 'aceite');
  const p = await garantirPerfil(db, user.tenantId);
  const c = await contagens(db, p.id);
  const faltam = pendentesParaPublicar(p, c);
  if (faltam.length) throw new UserError(`Para publicar, conclua: ${faltam.map((e) => e.titulo.toLowerCase()).join(', ')}.`);
  await db.query(`UPDATE busca_perfis SET publicado = true, publicado_em = coalesce(publicado_em, now()), etapa_concluida = 7, updated_at = now() WHERE id = $1`, [p.id]);
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
  const [maxEventos, maxServicos, maxFotos, tags, cardapios, agenda] = await Promise.all([
    limite(tenantId, 'busca_tipos_evento'), limite(tenantId, 'busca_tipos_servico'), limite(tenantId, 'busca_fotos'),
    podeUsar(tenantId, 'busca_fotos_tags'), podeUsar(tenantId, 'busca_cardapios'), podeUsar(tenantId, 'busca_disponibilidade'),
  ]);
  return { maxEventos, maxServicos, maxFotos, tags, cardapios, agenda };
}

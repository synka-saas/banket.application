// Onboarding do perfil no Banket Busca: as 6 etapas, quando cada uma está concluída, quando o perfil pode
// ser publicado (etapas 1 a 5) e a completude (0–100) usada no ranking. Puro e testado (onboarding.test.ts).
// Sem pacotes nem preço (decisão de 16/10/2026: o Busca não divulga preço). Cardápios e Disponibilidade não são
// etapas: aparecem na lista como recursos "Exclusivo Banket" (vêm do próprio Banket).

export interface EtapaOnboarding {
  n: number;
  slug: 'empresa' | 'eventos' | 'regiao' | 'capacidade' | 'fotos' | 'revisao';
  titulo: string;
  sub: string;
  /** Título e apoio da página da etapa */
  h: string;
  p: string;
}

export const ETAPAS: EtapaOnboarding[] = [
  { n: 1, slug: 'empresa', titulo: 'Dados da empresa', sub: 'Do cadastro da empresa + descrição', h: 'Conte quem é o seu buffet', p: 'Esses dados aparecem no seu perfil público. O CNPJ ou CPF não aparece para os clientes.' },
  { n: 2, slug: 'eventos', titulo: 'Eventos e serviços', sub: 'O que você atende', h: 'Que eventos você atende?', p: 'Seu buffet aparece nas buscas desses tipos de evento e serviço.' },
  { n: 3, slug: 'regiao', titulo: 'Região de atendimento', sub: 'Espaço próprio e domicílio', h: 'Onde você atende?', p: 'Pedidos fora da sua região não chegam até você.' },
  { n: 4, slug: 'capacidade', titulo: 'Capacidade', sub: 'Mínimo e máximo de convidados', h: 'Quantos convidados você atende?', p: 'Usamos a faixa para mostrar seu buffet só em eventos que você comporta.' },
  { n: 5, slug: 'fotos', titulo: 'Fotos e galeria', sub: 'A primeira é a capa', h: 'Mostre o seu trabalho', p: 'Comece pelo salão montado, depois a comida de perto. A primeira foto é a capa.' },
  { n: 6, slug: 'revisao', titulo: 'Revisão e publicação', sub: 'Confira e publique', h: 'Revise e publique', p: 'É assim que o seu buffet aparece na busca. Publique quando estiver tudo certo.' },
];

/** Etapa de revisão/publicação (a última) e a quantidade de etapas exigidas para publicar. */
export const ETAPA_REVISAO = ETAPAS.length;
export const ETAPAS_PARA_PUBLICAR = ETAPA_REVISAO - 1;
export const ETAPA_FOTOS = 5;

/** Recursos exclusivos de clientes Banket que aparecem na lista de etapas com cadeado (plano gratuito). */
export const EXCLUSIVOS = [
  { recurso: 'busca_cardapios', titulo: 'Cardápios', sub: 'Suas opções de cardápio no perfil' },
  { recurso: 'busca_disponibilidade', titulo: 'Disponibilidade', sub: 'Agenda sincronizada com o Banket' },
] as const;

export const MIN_FOTOS_PUBLICAR = 3;
export const MIN_DESCRICAO = 80;

export interface EstadoPerfil {
  nome: string | null;
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
  atende_domicilio: boolean;
  raio_km: number | null;
  espaco_proprio: boolean;
  logradouro: string | null;
  cidade_id: number | null;
  capacidade_min: number | null;
  capacidade_max: number | null;
  tempo_resposta_texto: string | null;
  publicado: boolean;
}

export interface Contagens {
  /** Fotos visíveis (não bloqueadas pelo plano) */
  fotos: number;
}

const preenchido = (v: string | null | undefined) => Boolean(v && v.trim());

/** Etapas concluídas (1–5 pelos dados; 6 = publicado). */
export function etapasConcluidas(p: EstadoPerfil, c: Contagens): Set<number> {
  const ok = new Set<number>();
  if (preenchido(p.nome) && preenchido(p.documento) && (preenchido(p.whatsapp) || preenchido(p.telefone)) && preenchido(p.email_contato) && (p.descricao?.trim().length ?? 0) >= MIN_DESCRICAO) ok.add(1);
  if (p.tipos_evento.length > 0 && p.tipos_servico.length > 0) ok.add(2);
  const espaco = p.espaco_proprio && preenchido(p.logradouro);
  const domicilio = p.atende_domicilio && (p.raio_km ?? 0) > 0;
  if (p.cidade_id != null && (espaco || domicilio)) ok.add(3);
  if (p.capacidade_min != null && p.capacidade_max != null && p.capacidade_min <= p.capacidade_max) ok.add(4);
  if (c.fotos >= MIN_FOTOS_PUBLICAR) ok.add(ETAPA_FOTOS);
  if (p.publicado) ok.add(ETAPA_REVISAO);
  return ok;
}

/** Etapas que ainda faltam para publicar (1 a 5). */
export function pendentesParaPublicar(p: EstadoPerfil, c: Contagens): EtapaOnboarding[] {
  const ok = etapasConcluidas(p, c);
  return ETAPAS.filter((e) => e.n <= ETAPAS_PARA_PUBLICAR && !ok.has(e.n));
}

export const podePublicar = (p: EstadoPerfil, c: Contagens) => pendentesParaPublicar(p, c).length === 0;

/** Primeira etapa não concluída (onde o "Continuar cadastro" leva). */
export function proximaEtapa(p: EstadoPerfil, c: Contagens): number {
  return pendentesParaPublicar(p, c)[0]?.n ?? ETAPA_REVISAO;
}

/**
 * Completude 0–100 (ranking e painel). Pesos: descrição longa 15, tipos de evento e serviço 10, logo 10, fotos até 5
 * (proporcional) 25, região 10, capacidade 10, contato (e-mail e WhatsApp) 10, Instagram ou site 5, tempo de
 * resposta 5. A migration 034 repete a mesma conta em SQL para recalcular os perfis existentes.
 */
export function completude(p: EstadoPerfil, c: Contagens): number {
  const ok = etapasConcluidas(p, c);
  const desc = p.descricao?.trim().length ?? 0;
  let pts = 0;
  pts += desc >= 300 ? 15 : desc >= MIN_DESCRICAO ? 8 : 0;
  pts += ok.has(2) ? 10 : 0;
  pts += preenchido(p.logo_path) ? 10 : 0;
  pts += Math.round((Math.min(c.fotos, 5) / 5) * 25);
  pts += ok.has(3) ? 10 : 0;
  pts += ok.has(4) ? 10 : 0;
  pts += (preenchido(p.email_contato) ? 5 : 0) + (preenchido(p.whatsapp) ? 5 : 0);
  pts += preenchido(p.instagram) || preenchido(p.site) ? 5 : 0;
  pts += preenchido(p.tempo_resposta_texto) ? 5 : 0;
  return Math.min(100, pts);
}

/** Linhas de leitura da etapa de revisão (o que foi preenchido em cada etapa). */
export function resumoEtapas(p: EstadoPerfil, c: Contagens, rotulos: { cidade: string | null }): Record<number, string> {
  const atend = [p.espaco_proprio ? 'Espaço próprio' : null, p.atende_domicilio ? `Domicílio até ${p.raio_km ?? '—'} km` : null].filter(Boolean).join(' + ');
  return {
    1: [p.nome, p.email_contato].filter(Boolean).join(' · ') || 'Faltam os dados da empresa',
    2: `${p.tipos_evento.length} ${p.tipos_evento.length === 1 ? 'tipo de evento' : 'tipos de evento'} · ${p.tipos_servico.length} ${p.tipos_servico.length === 1 ? 'serviço' : 'serviços'}`,
    3: [atend || 'Nenhum modo de atendimento', rotulos.cidade].filter(Boolean).join(' · '),
    4: p.capacidade_min != null && p.capacidade_max != null ? `${p.capacidade_min} a ${p.capacidade_max} convidados` : 'Falta a faixa de convidados',
    5: `${c.fotos} ${c.fotos === 1 ? 'foto' : 'fotos'}${c.fotos < MIN_FOTOS_PUBLICAR ? ` · mínimo de ${MIN_FOTOS_PUBLICAR} para publicar` : ' · capa definida'}`,
  };
}

// ---------------------------------------------------------------------------
// Endereço do perfil (/buffet/<slug>): UUID do perfil por padrão; com o recurso busca_slug, gerado do nome do buffet
// (o usuário não digita: muda sozinho quando o nome muda, e o anterior segue redirecionando)
// ---------------------------------------------------------------------------
export const SLUG_MIN = 3;
export const SLUG_MAX = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ehUuid = (v: string | null | undefined) => Boolean(v && UUID.test(v));

/** Normaliza o que foi digitado ("Buffet São João!" → "buffet-sao-joao"). */
export function normalizarSlug(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

/** Endereços que nenhum buffet pode usar: rotas e nomes do próprio Banket. */
const SLUGS_RESERVADOS = new Set([
  'admin', 'api', 'app', 'auth', 'avaliar', 'busca', 'buscar', 'buffet', 'buffets', 'cadastro', 'conta', 'contato',
  'equipe', 'login', 'orcamento', 'para-buffets', 'planos', 'privacidade', 'suporte', 'termos', 'vitrine',
]);

/** Motivo pelo qual o endereço não pode ser usado (null = válido). Não confere se já está em uso. */
export function problemaNoSlug(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `Use ao menos ${SLUG_MIN} letras ou números no endereço.`;
  if (slug.length > SLUG_MAX) return `O endereço pode ter até ${SLUG_MAX} caracteres.`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'Use só letras minúsculas, números e hífens no endereço.';
  if (ehUuid(slug)) return 'Escolha um endereço com o nome do buffet.';
  if (SLUGS_RESERVADOS.has(slug) || /^banket(-|$)/.test(slug)) return 'Esse endereço é reservado. Escolha um com o nome do buffet.';
  return null;
}

/** Raios de atendimento em domicílio oferecidos na etapa Região (km); o servidor só aceita estes. */
export const RAIOS_DOMICILIO = [10, 25, 50, 100];

/** Endereços antigos guardados por perfil (redirecionam 301): só os mais recentes, para ninguém acumular nomes. */
export const MAX_SLUGS_ANTIGOS = 3;

/**
 * Endereço base a partir do nome do buffet ("Buffet São João" → "buffet-sao-joao"); null quando o nome não rende um
 * endereço válido (curto demais, só símbolos). Nomes curtos ganham "buffet-" na frente ("Lá" → "buffet-la").
 */
export function slugDoNome(nome: string | null | undefined): string | null {
  const base = normalizarSlug(nome ?? '');
  if (!problemaNoSlug(base)) return base;
  const comPrefixo = normalizarSlug(`buffet ${nome ?? ''}`);
  return base && !problemaNoSlug(comPrefixo) ? comPrefixo : null;
}

/** O endereço atual já acompanha o nome (a base, ou a base com o sufixo numérico usado para desempatar)? */
export function slugAcompanhaNome(slug: string, base: string): boolean {
  return slug === base || (slug.startsWith(`${base}-`) && /^\d+$/.test(slug.slice(base.length + 1)));
}

/** Endereços a tentar, em ordem: a base, depois base-2, base-3… (sempre dentro do tamanho máximo). */
export function candidatosSlug(base: string, quantidade = 50): string[] {
  const lista = [base];
  for (let n = 2; lista.length < quantidade; n++) {
    const sufixo = `-${n}`;
    lista.push(`${base.slice(0, SLUG_MAX - sufixo.length).replace(/-+$/g, '')}${sufixo}`);
  }
  return lista;
}

/** Sugestões de endereço (IA ou variações do nome) normalizadas, válidas, sem repetir e sem o endereço atual. */
export function filtrarSugestoesSlug(lista: unknown[], atual: string | null = null, limite = 12): string[] {
  const vistos = new Set<string>(atual ? [atual] : []);
  const out: string[] = [];
  for (const item of lista) {
    if (typeof item !== 'string') continue;
    const s = normalizarSlug(item);
    if (!s || vistos.has(s) || problemaNoSlug(s)) continue;
    vistos.add(s);
    out.push(s);
    if (out.length >= limite) break;
  }
  return out;
}

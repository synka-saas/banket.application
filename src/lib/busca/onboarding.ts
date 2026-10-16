// Onboarding do perfil no Banket Busca (PLANO.md §7): as 7 etapas, quando cada uma está concluída, quando o perfil pode
// ser publicado (etapas 1 a 6) e a completude (0–100) usada no ranking. Puro e testado (onboarding.test.ts).
// Cardápios e Disponibilidade não são etapas: aparecem na lista como recursos "Exclusivo Banket".

export interface EtapaOnboarding {
  n: number;
  slug: 'empresa' | 'eventos' | 'regiao' | 'capacidade' | 'pacotes' | 'fotos' | 'revisao';
  titulo: string;
  sub: string;
  /** Título e apoio da página da etapa */
  h: string;
  p: string;
}

export const ETAPAS: EtapaOnboarding[] = [
  { n: 1, slug: 'empresa', titulo: 'Dados da empresa', sub: 'Nome, contato e descrição', h: 'Conte quem é o seu buffet', p: 'Esses dados aparecem no seu perfil público. O CNPJ ou CPF não aparece para os clientes.' },
  { n: 2, slug: 'eventos', titulo: 'Eventos e serviços', sub: 'O que você atende', h: 'Que eventos você atende?', p: 'Seu buffet aparece nas buscas desses tipos de evento e serviço.' },
  { n: 3, slug: 'regiao', titulo: 'Região de atendimento', sub: 'Espaço próprio e domicílio', h: 'Onde você atende?', p: 'Pedidos fora da sua região não chegam até você.' },
  { n: 4, slug: 'capacidade', titulo: 'Capacidade', sub: 'Mínimo e máximo de convidados', h: 'Quantos convidados você atende?', p: 'Usamos a faixa para mostrar seu buffet só em eventos que você comporta.' },
  { n: 5, slug: 'pacotes', titulo: 'Pacotes', sub: 'Preço por pessoa', h: 'Seus pacotes', p: 'Nome, descrição, preço por pessoa e faixa de convidados de cada pacote.' },
  { n: 6, slug: 'fotos', titulo: 'Fotos e galeria', sub: 'A primeira é a capa', h: 'Mostre o seu trabalho', p: 'Comece pelo salão montado, depois a comida de perto. A primeira foto é a capa.' },
  { n: 7, slug: 'revisao', titulo: 'Revisão e publicação', sub: 'Confira e publique', h: 'Revise e publique', p: 'É assim que o seu buffet aparece na busca. Publique quando estiver tudo certo.' },
];

/** Recursos exclusivos de clientes Banket que aparecem na lista de etapas com cadeado (plano gratuito). */
export const EXCLUSIVOS = [
  { recurso: 'busca_cardapios', titulo: 'Cardápios', sub: 'Seções e itens de cada pacote' },
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
  pacotes: number;
  /** Fotos visíveis (não bloqueadas pelo plano) */
  fotos: number;
}

const preenchido = (v: string | null | undefined) => Boolean(v && v.trim());

/** Etapas concluídas (1–6 pelos dados; 7 = publicado). */
export function etapasConcluidas(p: EstadoPerfil, c: Contagens): Set<number> {
  const ok = new Set<number>();
  if (preenchido(p.nome) && preenchido(p.documento) && (preenchido(p.whatsapp) || preenchido(p.telefone)) && preenchido(p.email_contato) && (p.descricao?.trim().length ?? 0) >= MIN_DESCRICAO) ok.add(1);
  if (p.tipos_evento.length > 0 && p.tipos_servico.length > 0) ok.add(2);
  const espaco = p.espaco_proprio && preenchido(p.logradouro);
  const domicilio = p.atende_domicilio && (p.raio_km ?? 0) > 0;
  if (p.cidade_id != null && (espaco || domicilio)) ok.add(3);
  if (p.capacidade_min != null && p.capacidade_max != null && p.capacidade_min <= p.capacidade_max) ok.add(4);
  if (c.pacotes > 0) ok.add(5);
  if (c.fotos >= MIN_FOTOS_PUBLICAR) ok.add(6);
  if (p.publicado) ok.add(7);
  return ok;
}

/** Etapas que ainda faltam para publicar (1 a 6). */
export function pendentesParaPublicar(p: EstadoPerfil, c: Contagens): EtapaOnboarding[] {
  const ok = etapasConcluidas(p, c);
  return ETAPAS.filter((e) => e.n <= 6 && !ok.has(e.n));
}

export const podePublicar = (p: EstadoPerfil, c: Contagens) => pendentesParaPublicar(p, c).length === 0;

/** Primeira etapa não concluída (onde o "Continuar cadastro" leva). */
export function proximaEtapa(p: EstadoPerfil, c: Contagens): number {
  return pendentesParaPublicar(p, c)[0]?.n ?? 7;
}

/**
 * Completude 0–100 (ranking e painel). Pesos: descrição longa 15, tipos de evento e serviço 10, logo 10, fotos até 5
 * (proporcional) 15, pacotes até 2 (proporcional) 10, região 10, capacidade 10, contato (e-mail e WhatsApp) 10,
 * Instagram ou site 5, tempo de resposta 5.
 */
export function completude(p: EstadoPerfil, c: Contagens): number {
  const ok = etapasConcluidas(p, c);
  const desc = p.descricao?.trim().length ?? 0;
  let pts = 0;
  pts += desc >= 300 ? 15 : desc >= MIN_DESCRICAO ? 8 : 0;
  pts += ok.has(2) ? 10 : 0;
  pts += preenchido(p.logo_path) ? 10 : 0;
  pts += Math.round((Math.min(c.fotos, 5) / 5) * 15);
  pts += Math.round((Math.min(c.pacotes, 2) / 2) * 10);
  pts += ok.has(3) ? 10 : 0;
  pts += ok.has(4) ? 10 : 0;
  pts += (preenchido(p.email_contato) ? 5 : 0) + (preenchido(p.whatsapp) ? 5 : 0);
  pts += preenchido(p.instagram) || preenchido(p.site) ? 5 : 0;
  pts += preenchido(p.tempo_resposta_texto) ? 5 : 0;
  return Math.min(100, pts);
}

/** Linhas de leitura da etapa de revisão (o que foi preenchido em cada etapa). */
export function resumoEtapas(p: EstadoPerfil, c: Contagens, rotulos: { cidade: string | null; precoMin: number | null }): Record<number, string> {
  const atend = [p.espaco_proprio ? 'Espaço próprio' : null, p.atende_domicilio ? `Domicílio até ${p.raio_km ?? '—'} km` : null].filter(Boolean).join(' + ');
  const preco = rotulos.precoMin != null ? ` · a partir de R$ ${rotulos.precoMin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
  return {
    1: [p.nome, p.email_contato].filter(Boolean).join(' · ') || 'Faltam os dados da empresa',
    2: `${p.tipos_evento.length} ${p.tipos_evento.length === 1 ? 'tipo de evento' : 'tipos de evento'} · ${p.tipos_servico.length} ${p.tipos_servico.length === 1 ? 'serviço' : 'serviços'}`,
    3: [atend || 'Nenhum modo de atendimento', rotulos.cidade].filter(Boolean).join(' · '),
    4: p.capacidade_min != null && p.capacidade_max != null ? `${p.capacidade_min} a ${p.capacidade_max} convidados` : 'Falta a faixa de convidados',
    5: `${c.pacotes} ${c.pacotes === 1 ? 'pacote' : 'pacotes'}${preco}`,
    6: `${c.fotos} ${c.fotos === 1 ? 'foto' : 'fotos'}${c.fotos < MIN_FOTOS_PUBLICAR ? ` · mínimo de ${MIN_FOTOS_PUBLICAR} para publicar` : ' · capa definida'}`,
  };
}

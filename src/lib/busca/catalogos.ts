// Catálogos fixos do Banket Busca (PLANO.md §2.3): tipos de evento e de serviço globais (ampliados com os da base importada), iguais para todas as
// empresas (a vitrine compara buffets de empresas diferentes), restrições alimentares e o mapeamento para os tipos
// de evento do app (Social/Corporativo, migration 030). Puro: roda no navegador e no servidor.

export interface ItemCatalogo {
  slug: string;
  rotulo: string;
  /** Ícone Tabler (lib/icones.ts) */
  icone: string;
}

export const TIPOS_EVENTO: (ItemCatalogo & { natureza: 'social' | 'corporativo'; plural: string })[] = [
  { slug: 'casamento', rotulo: 'Casamento', plural: 'casamentos', icone: 'heart', natureza: 'social' },
  { slug: 'bodas', rotulo: 'Bodas', plural: 'bodas', icone: 'heart-handshake', natureza: 'social' },
  { slug: 'aniversario', rotulo: 'Aniversário', plural: 'aniversários', icone: 'cake', natureza: 'social' },
  { slug: 'infantil', rotulo: 'Festa infantil', plural: 'festas infantis', icone: 'balloon', natureza: 'social' },
  { slug: 'debutante', rotulo: 'Debutante (15 anos)', plural: 'festas de 15 anos', icone: 'sparkles', natureza: 'social' },
  { slug: 'formatura', rotulo: 'Formatura', plural: 'formaturas', icone: 'school', natureza: 'social' },
  { slug: 'batizado', rotulo: 'Batizado e primeira comunhão', plural: 'batizados', icone: 'baby-carriage', natureza: 'social' },
  { slug: 'religioso', rotulo: 'Evento religioso', plural: 'eventos religiosos', icone: 'users-group', natureza: 'social' },
  { slug: 'cha', rotulo: 'Chá de bebê ou de casa nova', plural: 'chás', icone: 'gift', natureza: 'social' },
  { slug: 'churrasco', rotulo: 'Churrasco', plural: 'churrascos', icone: 'flame', natureza: 'social' },
  { slug: 'confraternizacao', rotulo: 'Confraternização', plural: 'confraternizações', icone: 'glass-full', natureza: 'corporativo' },
  { slug: 'corporativo', rotulo: 'Evento corporativo', plural: 'eventos corporativos', icone: 'briefcase', natureza: 'corporativo' },
  { slug: 'coffee_break', rotulo: 'Coffee break', plural: 'coffee breaks', icone: 'coffee', natureza: 'corporativo' },
  { slug: 'lancamento', rotulo: 'Lançamento e feira', plural: 'lançamentos', icone: 'speakerphone', natureza: 'corporativo' },
  { slug: 'outros', rotulo: 'Outros eventos', plural: 'outros eventos', icone: 'calendar-event', natureza: 'social' },
];

export const TIPOS_SERVICO: ItemCatalogo[] = [
  { slug: 'buffet_completo', rotulo: 'Buffet completo', icone: 'tools-kitchen-2' },
  { slug: 'buffet_casamento', rotulo: 'Buffet de casamento', icone: 'heart' },
  { slug: 'buffet_infantil', rotulo: 'Buffet infantil', icone: 'balloon' },
  { slug: 'buffet_domicilio', rotulo: 'Buffet em domicílio', icone: 'home' },
  { slug: 'catering', rotulo: 'Catering', icone: 'soup' },
  { slug: 'espaco_eventos', rotulo: 'Espaço para eventos', icone: 'building' },
  { slug: 'salao_festas', rotulo: 'Salão de festas', icone: 'confetti' },
  { slug: 'finger_food', rotulo: 'Finger food', icone: 'cookie' },
  { slug: 'coquetel', rotulo: 'Coquetel volante', icone: 'glass-full' },
  { slug: 'empratado', rotulo: 'Empratado', icone: 'chef-hat' },
  { slug: 'churrasco', rotulo: 'Churrasco', icone: 'flame' },
  { slug: 'food_truck', rotulo: 'Food truck', icone: 'truck' },
  { slug: 'coffee_break', rotulo: 'Coffee break', icone: 'coffee' },
  { slug: 'doces_bolo', rotulo: 'Doces e bolo', icone: 'cake' },
  { slug: 'bar_bebidas', rotulo: 'Bar e bebidas', icone: 'bottle' },
  { slug: 'kids', rotulo: 'Cardápio infantil', icone: 'mood-kid' },
];

/** Mesmos valores de catalogo_itens.restricoes */
export const RESTRICOES: { slug: string; rotulo: string }[] = [
  { slug: 'vegetariana', rotulo: 'Vegetariana' },
  { slug: 'vegana', rotulo: 'Vegana' },
  { slug: 'sem_gluten', rotulo: 'Sem glúten' },
  { slug: 'sem_lactose', rotulo: 'Sem lactose' },
  { slug: 'alergenicos', rotulo: 'Atenção a alergênicos' },
];

const mapa = <T extends { slug: string }>(lista: T[]) => new Map(lista.map((i) => [i.slug, i]));
const EVENTOS = mapa(TIPOS_EVENTO);
const SERVICOS = mapa(TIPOS_SERVICO);
const RESTR = mapa(RESTRICOES);

export const tipoEvento = (slug: string) => EVENTOS.get(slug);
export const tipoServico = (slug: string) => SERVICOS.get(slug);
export const rotuloEvento = (slug: string) => EVENTOS.get(slug)?.rotulo ?? slug;
export const rotuloServico = (slug: string) => SERVICOS.get(slug)?.rotulo ?? slug;
export const rotuloRestricao = (slug: string) => RESTR.get(slug)?.rotulo ?? slug;

export const ehTipoEvento = (v: unknown): v is string => typeof v === 'string' && EVENTOS.has(v);
export const ehTipoServico = (v: unknown): v is string => typeof v === 'string' && SERVICOS.has(v);
export const ehRestricao = (v: unknown): v is string => typeof v === 'string' && RESTR.has(v);

/** Slug do tipo de evento do app (tipos_evento.slug, fixos desde a migration 030) para um tipo da vitrine. */
export const naturezaDoEvento = (slug: string): 'social' | 'corporativo' => EVENTOS.get(slug)?.natureza ?? 'social';

/** Mantém só os slugs válidos, sem repetição, na ordem do catálogo. */
export function filtrarSlugs(valores: unknown, catalogo: { slug: string }[]): string[] {
  const lista = Array.isArray(valores) ? valores : typeof valores === 'string' ? [valores] : [];
  const pedidos = new Set(lista.filter((v): v is string => typeof v === 'string'));
  return catalogo.filter((c) => pedidos.has(c.slug)).map((c) => c.slug);
}

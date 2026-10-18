// Catálogo dos recursos controlados por plano.
// Os VALORES de cada plano ficam em `planos.recursos` (migration 031); aqui ficam só as definições: slug tipado,
// rótulo, descrição, tipo e grupo, usados pela página /planos, pelo painel de upsell e pelo gating.
// Roda no navegador (painel de upsell): não importe nada de Node aqui.

export type TipoRecurso = 'booleano' | 'limite';
export type GrupoRecurso = 'modulos' | 'limites' | 'busca';

export interface Recurso {
  slug: string;
  rotulo: string;
  descricao: string;
  tipo: TipoRecurso;
  grupo: GrupoRecurso;
  /** Unidade do limite, para "4 de 5 templates" */
  unidade?: string;
}

/** Módulos do app: o slug é o que `lib/planos/rotas.ts` associa a cada prefixo de rota e `nav.ts` a cada item do menu. */
export const MODULOS = [
  'propostas', 'inbox', 'cardapios', 'clientes', 'agenda', 'formularios', 'financeiro', 'estoque', 'staff',
  'espacos', 'templates', 'documentos', 'pesquisas', 'reunioes', 'ia', 'configuracoes', 'busca',
] as const;
export type Modulo = (typeof MODULOS)[number];

export const RECURSOS: Recurso[] = [
  // Módulos
  { slug: 'propostas', rotulo: 'Painel de Propostas e orçamentos', descricao: 'Funil de vendas (Kanban), orçamento versionado, proposta em PDF e dashboard.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'inbox', rotulo: 'Inbox', descricao: 'Conversas por e-mail com o cliente dentro do evento, com envio da proposta e respostas no sistema.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'cardapios', rotulo: 'Cardápios', descricao: 'Catálogo de seções, itens e opções prontas com preço, custo e porção.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'clientes', rotulo: 'Clientes', descricao: 'Cadastro de clientes com histórico de eventos e importação por CSV.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'agenda', rotulo: 'Agenda', descricao: 'Eventos por mês e semana, coloridos pela etapa.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'formularios', rotulo: 'Formulários de captação', descricao: 'Formulário público que cria o pedido direto no funil.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'financeiro', rotulo: 'Financeiro', descricao: 'Contas a receber e a pagar, plano de pagamento do evento, fluxo de caixa.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'estoque', rotulo: 'Estoque', descricao: 'Itens, movimentações, custo médio e cobertura da lista de compras.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'staff', rotulo: 'Staff', descricao: 'Serviços com regra de dimensionamento e base de profissionais.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'espacos', rotulo: 'Espaços', descricao: 'Espaços próprios e de terceiros com faixas de locação.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'templates', rotulo: 'Templates da proposta', descricao: 'Identidade visual das propostas em PDF e blocos de texto.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'documentos', rotulo: 'Documentos e contratos', descricao: 'Modelos com variáveis, numeração por ano e PDF.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'pesquisas', rotulo: 'Pesquisa de satisfação', descricao: 'NPS e CSAT pós-evento com envio por e-mail e painel.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'reunioes', rotulo: 'Reuniões com Google Meet', descricao: 'Degustações e visitas agendadas na sua agenda Google.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'ia', rotulo: 'Assistentes de IA', descricao: 'Assistente de Negociação e Assistente de Orçamentos.', tipo: 'booleano', grupo: 'modulos' },
  { slug: 'configuracoes', rotulo: 'Configurações', descricao: 'Usuários, etapas do funil, ocasiões, formatos, modelos de e-mail e dados da empresa.', tipo: 'booleano', grupo: 'modulos' },
  // Limites
  { slug: 'usuarios', rotulo: 'Usuários ativos', descricao: 'Pessoas com acesso à empresa (convites pendentes contam).', tipo: 'limite', grupo: 'limites', unidade: 'usuários' },
  { slug: 'espacos_qtd', rotulo: 'Espaços', descricao: 'Espaços ativos.', tipo: 'limite', grupo: 'limites', unidade: 'espaços' },
  { slug: 'templates_qtd', rotulo: 'Templates', descricao: 'Templates de proposta.', tipo: 'limite', grupo: 'limites', unidade: 'templates' },
  { slug: 'cardapios_opcoes', rotulo: 'Opções de cardápio', descricao: 'Opções prontas ativas.', tipo: 'limite', grupo: 'limites', unidade: 'opções' },
  { slug: 'formularios_qtd', rotulo: 'Formulários', descricao: 'Formulários públicos ativos.', tipo: 'limite', grupo: 'limites', unidade: 'formulários' },
  { slug: 'documento_modelos', rotulo: 'Modelos de documento', descricao: 'Modelos ativos.', tipo: 'limite', grupo: 'limites', unidade: 'modelos' },
  { slug: 'email_modelos', rotulo: 'Modelos de e-mail', descricao: 'Modelos ativos.', tipo: 'limite', grupo: 'limites', unidade: 'modelos' },
  { slug: 'estoque_itens', rotulo: 'Itens em estoque', descricao: 'Itens ativos.', tipo: 'limite', grupo: 'limites', unidade: 'itens' },
  { slug: 'ia_analises_mes', rotulo: 'Análises de IA por mês', descricao: 'Negociação e orçamentos somadas.', tipo: 'limite', grupo: 'limites', unidade: 'análises' },
  { slug: 'ia_fundos_mes', rotulo: 'Fundos de template por IA por mês', descricao: 'Imagens geradas.', tipo: 'limite', grupo: 'limites', unidade: 'imagens' },
  // Banket Busca
  { slug: 'busca', rotulo: 'Banket Busca', descricao: 'Perfil público no marketplace e pedidos de orçamento.', tipo: 'booleano', grupo: 'busca' },
  { slug: 'busca_personalizado', rotulo: 'Banket Busca Personalizado', descricao: 'Perfil Personalizado: selo, prioridade, cardápios, agenda, formulário de orçamento, mais fotos em grupos e endereço com o nome.', tipo: 'booleano', grupo: 'busca' },
  { slug: 'busca_selo', rotulo: 'Selo Cliente Banket', descricao: 'Identificação de cliente nos resultados e no perfil.', tipo: 'booleano', grupo: 'busca' },
  { slug: 'busca_prioridade', rotulo: 'Prioridade nos resultados', descricao: 'Perfis personalizados aparecem antes dos perfis simples.', tipo: 'booleano', grupo: 'busca' },
  { slug: 'busca_cardapios', rotulo: 'Cardápios detalhados no perfil', descricao: 'Suas opções de cardápio, com seções e itens, direto do seu catálogo.', tipo: 'booleano', grupo: 'busca' },
  { slug: 'busca_disponibilidade', rotulo: 'Disponibilidade em tempo real', descricao: 'Selo "Disponível na data" a partir da sua agenda.', tipo: 'booleano', grupo: 'busca' },
  { slug: 'busca_slug', rotulo: 'Endereço personalizado do perfil', descricao: 'busca.banket.com.br/buffet/seu-buffet no lugar do código do perfil.', tipo: 'booleano', grupo: 'busca' },
  { slug: 'busca_fotos_tags', rotulo: 'Grupos de fotos', descricao: 'Organize a galeria em grupos, um para cada evento realizado.', tipo: 'booleano', grupo: 'busca' },
  { slug: 'busca_aviso_email', rotulo: 'Aviso de pedido por e-mail', descricao: 'Cada pedido chega também no seu e-mail.', tipo: 'booleano', grupo: 'busca' },
  { slug: 'busca_aviso_whatsapp', rotulo: 'Aviso de pedido por WhatsApp', descricao: 'Cada pedido chega também no seu WhatsApp.', tipo: 'booleano', grupo: 'busca' },
  { slug: 'busca_fotos', rotulo: 'Fotos no perfil', descricao: 'Galeria do perfil público.', tipo: 'limite', grupo: 'busca', unidade: 'fotos' },
  { slug: 'busca_tipos_evento', rotulo: 'Tipos de evento atendidos', descricao: 'Eventos em que o perfil aparece.', tipo: 'limite', grupo: 'busca', unidade: 'tipos' },
  { slug: 'busca_tipos_servico', rotulo: 'Tipos de serviço', descricao: 'Serviços em que o perfil aparece.', tipo: 'limite', grupo: 'busca', unidade: 'tipos' },
  { slug: 'historico_meses', rotulo: 'Histórico', descricao: 'Meses de mensagens e pedidos fechados ou perdidos visíveis.', tipo: 'limite', grupo: 'busca', unidade: 'meses' },
];

const POR_SLUG = new Map(RECURSOS.map((r) => [r.slug, r]));
export const recurso = (slug: string): Recurso | undefined => POR_SLUG.get(slug);
export const rotuloRecurso = (slug: string): string => POR_SLUG.get(slug)?.rotulo ?? slug;

/** Texto do painel de upsell por recurso bloqueado (benefício em uma frase; os CTAs são os mesmos). */
export const BENEFICIOS: Record<string, { titulo: string; texto: string }> = {
  propostas: { titulo: 'Propostas que fecham mais eventos', texto: 'Com o Banket cada pedido vira um card no funil, o orçamento é versionado e a proposta sai em PDF com a sua marca.' },
  inbox: { titulo: 'Toda a conversa com o cliente num só lugar', texto: 'Envie a proposta por e-mail e receba as respostas dentro do evento, com histórico e modelos de mensagem.' },
  cardapios: { titulo: 'Cardápios com preço, custo e porção', texto: 'Monte opções prontas, calcule a margem e gere a lista de compras de cada evento.' },
  clientes: { titulo: 'Cadastro de clientes com histórico', texto: 'Todos os eventos de cada cliente, anotações e retornos combinados.' },
  agenda: { titulo: 'Agenda dos eventos', texto: 'Veja o mês e a semana com os eventos por etapa e as reuniões agendadas.' },
  formularios: { titulo: 'Formulário de captação no seu site', texto: 'Pedidos chegam prontos no funil, com data, local e número de convidados.' },
  financeiro: { titulo: 'Financeiro do evento', texto: 'Plano de pagamento no fechamento, contas a receber e a pagar, fluxo de caixa e resultado por evento.' },
  estoque: { titulo: 'Estoque e custo real', texto: 'Movimentações, custo médio, validade e cobertura da lista de compras.' },
  staff: { titulo: 'Equipe dimensionada pelo evento', texto: 'Funções com regra por convidados e base de profissionais.' },
  espacos: { titulo: 'Espaços e locação', texto: 'Espaços próprios e de terceiros com faixas de locação no orçamento.' },
  templates: { titulo: 'Propostas com a sua identidade', texto: 'Templates com capa, cores, fontes e fundos gerados por IA.' },
  documentos: { titulo: 'Contratos em um clique', texto: 'Modelos com variáveis do evento, numeração e PDF enviado pelo Inbox.' },
  pesquisas: { titulo: 'Pesquisa de satisfação', texto: 'NPS e CSAT depois do evento, com envio por e-mail e painel de resultados.' },
  reunioes: { titulo: 'Reuniões com Google Meet', texto: 'Agende degustações e visitas na sua agenda Google, com convite ao cliente.' },
  ia: { titulo: 'Assistentes de IA', texto: 'Temperatura da negociação, objeções e trocas de maior margem no orçamento.' },
  configuracoes: { titulo: 'Configurações da empresa', texto: 'Usuários, etapas do funil, ocasiões, formatos de serviço e modelos de e-mail.' },
  busca_cardapios: { titulo: 'Cardápios detalhados no seu perfil', texto: 'No Perfil Personalizado (todos os planos pagos), as opções de cardápio aparecem com seções e itens, direto do catálogo, sem digitar duas vezes.' },
  busca_disponibilidade: { titulo: 'Disponibilidade em tempo real', texto: 'Quem busca vê "Disponível na data" a partir da sua agenda. No Perfil Simples aparece "Consultar disponibilidade".' },
  busca_slug: { titulo: 'Um endereço com o nome do seu buffet', texto: 'No Perfil Personalizado (todos os planos pagos), o endereço do perfil leva o nome do buffet (busca.banket.com.br/buffet/seu-buffet), para divulgar no Instagram e no WhatsApp.' },
  busca_fotos: { titulo: 'Galeria maior, em grupos', texto: 'O Perfil Simples tem 5 fotos gerais. No Perfil Personalizado, até 30 fotos no Essencial e no Profissional e 60 no Prime, em grupos por evento; sem limite no Master.' },
  busca_tipos_evento: { titulo: 'Apareça em mais buscas', texto: 'No Perfil Personalizado, até 6 tipos de evento e 6 de serviço no Essencial e no Profissional e 10 no Prime; sem limite no Master.' },
  busca_tipos_servico: { titulo: 'Apareça em mais buscas', texto: 'No Perfil Personalizado, até 6 tipos de evento e 6 de serviço no Essencial e no Profissional e 10 no Prime; sem limite no Master.' },
  busca_prioridade: { titulo: 'Apareça primeiro', texto: 'No Perfil Personalizado (todos os planos pagos), o buffet ganha impulso no ranking, concorre às vagas de Destaque no topo da busca e leva o selo Cliente Banket.' },
  usuarios: { titulo: 'Mais pessoas na equipe', texto: 'Convide vendedores, operação e financeiro com papéis diferentes.' },
  historico_meses: { titulo: 'Histórico completo', texto: 'Planos pagos mantêm visíveis todas as mensagens e todos os pedidos, sem recorte de 3 meses.' },
};

/**
 * Destaques de cada plano nos cards de /planos (mesmo texto dos cards do site banket.com.br). O Banket Busca entra como
 * Personalizado em todos os planos pagos (migration 048; o Simples fica só no plano Busca). A comparação completa vem do catálogo.
 */
export const DESTAQUES_PLANO: Record<string, { rotulo: string; itens: string[] }> = {
  essencial: {
    rotulo: 'Inclui',
    itens: [
      'Orçamento versionado com PDF para download',
      'Lista de compras automática do evento',
      'Contrato em PDF com os dados do evento',
      'Painel de Propostas com as etapas padrão',
      'Agenda, espaços e staff calculado por convidados',
      'Banket Busca Personalizado: selo, destaque, cardápios, agenda e pedido de orçamento no perfil',
    ],
  },
  profissional: {
    rotulo: 'Tudo do Essencial, mais',
    itens: [
      'Envio da proposta pelo sistema, com respostas no Inbox',
      'Painel de Propostas personalizável',
      'Estoque com alertas e lista de compras com o que já tem',
      'Reuniões com Google Meet direto do evento',
      'Assistentes de IA de negociação e de orçamentos',
      'Pesquisa de satisfação que vira avaliação no Banket Busca',
    ],
  },
  prime: {
    rotulo: 'Tudo do Profissional, mais',
    itens: [
      'Até 10 templates, 20 cardápios, 10 formulários e 10 modelos de contrato',
      'Até 10 espaços e 15 usuários, com agenda por salão',
      '100 análises de IA e 20 fundos da proposta por IA por mês',
      'Banket Busca com até 60 fotos e 10 tipos de evento e de serviço',
    ],
  },
};

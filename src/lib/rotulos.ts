// Glossário da interface: um nome para cada conceito do domínio, usado em formulários, cards, resumos, filtros,
// exportações e Configurações. Só a interface usa estes nomes; tabelas e colunas do banco continuam as mesmas.
//
//   tipos_evento       → Tipo (Social, Corporativo)
//   categorias_evento  → Ocasião (Casamento, Aniversário…)
//   formatos_servico   → Formato de serviço (Buffet, Coquetel…)
//   estilo_*           → Estilo gastronômico
//   status_orcamento   → Etapa (coluna do funil)
//   espacos            → Espaço (nosso espaço / espaço de terceiro)

export const ROTULOS = {
  funil: 'Propostas',
  painelPropostas: 'Painel de Propostas',
  tipoEvento: 'Tipo',
  tiposEvento: 'Tipos de evento',
  ocasiao: 'Ocasião',
  ocasioes: 'Ocasiões',
  formatoServico: 'Formato de serviço',
  formatosServico: 'Formatos de serviço',
  estiloGastronomico: 'Estilo gastronômico',
  etapa: 'Etapa',
  etapas: 'Etapas do funil',
  verbaEstimada: 'Verba estimada',
  espaco: 'Espaço',
  espacos: 'Espaços',
} as const;

/** Natureza do pedido no formulário público (B2B/B2C) em linguagem do buffet. */
export const NATUREZA_PEDIDO: Record<string, string> = { B2B: 'Corporativo', B2C: 'Social' };

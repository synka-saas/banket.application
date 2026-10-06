// Variáveis dos modelos de documento ({cliente}, {data_evento_extenso}…) e detecção dos campos extras:
// toda {variavel} do texto que não é do sistema vira um campo a preencher na hora de gerar o documento.
// Função pura (roda no editor, no navegador, e no servidor).

export type GrupoVariavel = 'empresa' | 'cliente' | 'evento' | 'orcamento' | 'documento';

export interface VariavelDocumento {
  nome: string;
  rotulo: string;
  grupo: GrupoVariavel;
  exemplo: string;
}

export const GRUPOS_VARIAVEL: Record<GrupoVariavel, string> = {
  empresa: 'Empresa',
  cliente: 'Cliente',
  evento: 'Evento',
  orcamento: 'Orçamento',
  documento: 'Documento',
};

export const VARIAVEIS_DOCUMENTO: VariavelDocumento[] = [
  { nome: 'empresa', rotulo: 'Nome fantasia', grupo: 'empresa', exemplo: 'Banket Buffet' },
  { nome: 'empresa_razao_social', rotulo: 'Razão social', grupo: 'empresa', exemplo: 'Banket Eventos Ltda.' },
  { nome: 'empresa_documento', rotulo: 'CNPJ/CPF da empresa', grupo: 'empresa', exemplo: '12.345.678/0001-90' },
  { nome: 'empresa_endereco', rotulo: 'Endereço da empresa', grupo: 'empresa', exemplo: 'Rua das Flores, 100 – São Paulo/SP' },
  { nome: 'empresa_email', rotulo: 'E-mail da empresa', grupo: 'empresa', exemplo: 'contato@banket.com.br' },
  { nome: 'empresa_telefone', rotulo: 'Telefone da empresa', grupo: 'empresa', exemplo: '(11) 3333-0000' },
  { nome: 'assinante_nome', rotulo: 'Assinante (nome)', grupo: 'empresa', exemplo: 'Maria Souza' },
  { nome: 'assinante_cargo', rotulo: 'Assinante (cargo)', grupo: 'empresa', exemplo: 'Proprietária' },

  { nome: 'cliente', rotulo: 'Nome do cliente', grupo: 'cliente', exemplo: 'Ana Souza' },
  { nome: 'cliente_documento', rotulo: 'CPF/CNPJ do cliente', grupo: 'cliente', exemplo: '123.456.789-00' },
  { nome: 'cliente_email', rotulo: 'E-mail do cliente', grupo: 'cliente', exemplo: 'ana@exemplo.com' },
  { nome: 'cliente_telefone', rotulo: 'Telefone do cliente', grupo: 'cliente', exemplo: '(11) 99999-0000' },
  { nome: 'cliente_endereco', rotulo: 'Endereço do cliente', grupo: 'cliente', exemplo: 'Av. Paulista, 1000 – São Paulo/SP' },
  { nome: 'responsavel', rotulo: 'Responsável pelo evento', grupo: 'cliente', exemplo: 'Ana Souza' },
  { nome: 'responsavel_email', rotulo: 'E-mail do responsável', grupo: 'cliente', exemplo: 'ana@exemplo.com' },
  { nome: 'responsavel_whatsapp', rotulo: 'WhatsApp do responsável', grupo: 'cliente', exemplo: '(11) 99999-0000' },

  { nome: 'evento', rotulo: 'Título do evento', grupo: 'evento', exemplo: 'Casamento – Ana Souza' },
  { nome: 'data_evento', rotulo: 'Data do evento', grupo: 'evento', exemplo: '20/11/2027' },
  { nome: 'data_evento_extenso', rotulo: 'Data do evento por extenso', grupo: 'evento', exemplo: '20 de novembro de 2027' },
  { nome: 'hora_inicio', rotulo: 'Hora de início', grupo: 'evento', exemplo: '19:00' },
  { nome: 'hora_fim', rotulo: 'Hora de término', grupo: 'evento', exemplo: '00:00' },
  { nome: 'horario', rotulo: 'Horário (faixa)', grupo: 'evento', exemplo: '19h às 00h' },
  { nome: 'convidados', rotulo: 'Número de convidados', grupo: 'evento', exemplo: '150' },
  { nome: 'local', rotulo: 'Local (espaço)', grupo: 'evento', exemplo: 'Salão Jardim' },
  { nome: 'endereco_evento', rotulo: 'Endereço do evento', grupo: 'evento', exemplo: 'Rua das Flores, 100 – São Paulo/SP' },
  { nome: 'tipo_evento', rotulo: 'Tipo', grupo: 'evento', exemplo: 'Social' },
  { nome: 'ocasiao', rotulo: 'Ocasião', grupo: 'evento', exemplo: 'Casamento' },
  { nome: 'formato_servico', rotulo: 'Formato de serviço', grupo: 'evento', exemplo: 'Buffet' },

  { nome: 'valor_total', rotulo: 'Valor total', grupo: 'orcamento', exemplo: 'R$ 25.400,00' },
  { nome: 'valor_total_extenso', rotulo: 'Valor total por extenso', grupo: 'orcamento', exemplo: 'vinte e cinco mil e quatrocentos reais' },
  { nome: 'versao_orcamento', rotulo: 'Versão do orçamento', grupo: 'orcamento', exemplo: '02' },
  { nome: 'forma_pagamento', rotulo: 'Forma de pagamento (briefing)', grupo: 'orcamento', exemplo: '50% de sinal e saldo em 30 dias' },

  { nome: 'numero_documento', rotulo: 'Número do documento', grupo: 'documento', exemplo: '2026/0007' },
  { nome: 'data_hoje', rotulo: 'Data de hoje', grupo: 'documento', exemplo: '06/10/2026' },
  { nome: 'data_hoje_extenso', rotulo: 'Data de hoje por extenso', grupo: 'documento', exemplo: '6 de outubro de 2026' },
];

const NOMES_SISTEMA = new Set(VARIAVEIS_DOCUMENTO.map((v) => v.nome));

/** Valores de exemplo (prévia do editor e PDF de exemplo). */
export const EXEMPLO_VARIAVEIS: Record<string, string> = Object.fromEntries(VARIAVEIS_DOCUMENTO.map((v) => [v.nome, v.exemplo]));

/** Substitui {variavel} pelos valores; variáveis desconhecidas ficam como estão. */
export function aplicarVariaveis(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, nome: string) => (nome in valores ? valores[nome] : m));
}

/** Nomes das variáveis usadas num texto, na ordem em que aparecem, sem repetição. */
export function extrairVariaveis(texto: string): string[] {
  const vistas = new Set<string>();
  for (const m of texto.matchAll(/\{([a-z][a-z0-9_]*)\}/gi)) vistas.add(m[1].toLowerCase());
  return [...vistas];
}

export interface CampoExtra {
  chave: string;
  rotulo: string;
}

/** Rótulo legível a partir da chave: "numero_parcelas" → "Numero parcelas". */
export const rotuloDoCampo = (chave: string) => chave.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Variáveis que não são do sistema: viram campos a preencher ao gerar o documento. */
export function camposExtras(...textos: (string | null | undefined)[]): CampoExtra[] {
  const chaves = extrairVariaveis(textos.filter(Boolean).join('\n')).filter((n) => !NOMES_SISTEMA.has(n));
  return chaves.map((chave) => ({ chave, rotulo: rotuloDoCampo(chave) }));
}

export const ehVariavelDoSistema = (nome: string) => NOMES_SISTEMA.has(nome.toLowerCase());

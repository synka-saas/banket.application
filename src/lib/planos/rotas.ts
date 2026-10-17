// Mapa rota → recurso de plano (gate do middleware). Função pura, sem banco: o middleware pergunta aqui qual
// recurso uma URL exige e checa a empresa com lib/planos/gating. Testes em rotas.test.ts.
// Regras: prefixo mais específico primeiro; o que não está no mapa é livre (auth, público, /busca, /planos,
// /conta, /suporte, /api/sessao, /api/assinatura, /configuracoes/financeiro, /uploads, estáticos).
import type { Modulo } from './recursos';

/** [prefixo, recurso | null]. null = explicitamente livre (vence os prefixos seguintes). */
export const REGRAS: ReadonlyArray<readonly [string | RegExp, Modulo | null]> = [
  // Livres dentro de prefixos controlados
  ['/eventos/exportar', 'propostas'],
  // Aba Finanças e assistentes de IA do evento (antes do prefixo geral de eventos)
  [/^\/eventos\/[^/]+\/financas(\/|$)/, 'financeiro'],
  [/^\/eventos\/[^/]+\/(negociacao|assistente-orcamento|ia-contexto)(\/|$)/, 'ia'],
  [/^\/eventos\/[^/]+\/reunioes(\/|$)/, 'reunioes'],
  // Módulos
  ['/dashboard', 'propostas'],
  ['/eventos', 'propostas'],
  ['/api/eventos', 'propostas'],
  ['/api/orcamentos', 'propostas'],
  ['/inbox', 'inbox'],
  ['/cardapio', 'cardapios'],
  ['/api/cardapio', 'cardapios'],
  ['/clientes', 'clientes'],
  ['/agenda', 'agenda'],
  ['/reunioes', 'reunioes'],
  ['/api/google', 'reunioes'],
  ['/formularios', 'formularios'],
  ['/api/formularios', 'formularios'],
  ['/financeiro', 'financeiro'],
  ['/api/financeiro', 'financeiro'],
  ['/estoque', 'estoque'],
  ['/staff', 'staff'],
  ['/espacos', 'espacos'],
  ['/templates', 'templates'],
  ['/api/templates', 'templates'],
  ['/documentos', 'documentos'],
  ['/pesquisas', 'pesquisas'],
  ['/api/pesquisas', 'pesquisas'],
  // Configurações › Financeiro (assinatura): aberto a todo plano (é por ali que o plano gratuito assina)
  ['/configuracoes/financeiro', null],
  ['/configuracoes', 'configuracoes'],
  ['/api/configuracoes', 'configuracoes'],
];

/** Prefixo casa a URL inteira ou seguida de "/" ou "?" (nunca /eventosX). */
function casa(pathname: string, prefixo: string | RegExp): boolean {
  if (prefixo instanceof RegExp) return prefixo.test(pathname);
  if (!pathname.startsWith(prefixo)) return false;
  const proximo = pathname.charAt(prefixo.length);
  return proximo === '' || proximo === '/' || proximo === '?';
}

/** Recurso exigido por uma rota (null = livre). */
export function recursoDaRota(pathname: string): Modulo | null {
  for (const [prefixo, recurso] of REGRAS) {
    if (casa(pathname, prefixo)) return recurso;
  }
  return null;
}

/** Página inicial do plano: quem não tem o Painel de Propostas cai no Banket Busca. */
export const inicioDoPlano = (temPropostas: boolean): string => (temPropostas ? '/dashboard' : '/busca');

// Navegação principal e submenus compartilhados entre páginas de um mesmo módulo.
import { ROTULOS } from './rotulos';
import type { Modulo } from './planos/recursos';

/** Contadores mostrados ao lado de um item (chave = href), ex.: mensagens não lidas no Inbox */
export type BadgesNavegacao = Record<string, number>;

export interface ItemNavegacao {
  label: string;
  icon: string;
  href: string;
  match: string[];
  adminOnly?: boolean;
  /** Entra na barra inferior do celular (os demais ficam no painel "Mais") */
  barra?: boolean;
  /** Recurso do plano que libera o item (lib/planos); fora do plano, o item aparece com cadeado */
  recurso?: Modulo;
  /** Item do Banket Busca: o link abre a área pelo urlArea */
  marca?: 'busca';
  /** Fora do plano, em vez do cadeado o item leva a esta página (livre em todo plano) */
  hrefLivre?: string;
}

// Uma só lista para a sidebar (desktop) e a barra inferior + painel "Mais" (celular)
export const NAV_PRINCIPAL: ItemNavegacao[] = [
  { label: 'Dashboard', icon: 'layout-dashboard', href: '/dashboard', match: ['/dashboard'], barra: true, recurso: 'propostas' },
  { label: ROTULOS.funil, icon: 'layout-kanban', href: '/eventos', match: ['/eventos'], barra: true, recurso: 'propostas' },
  { label: 'Inbox', icon: 'mail', href: '/inbox', match: ['/inbox'], recurso: 'inbox' },
  { label: 'Cardápios', icon: 'tools-kitchen-2', href: '/cardapio/secoes', match: ['/cardapio'], recurso: 'cardapios' },
  { label: 'Clientes', icon: 'user-square', href: '/clientes', match: ['/clientes'], barra: true, recurso: 'clientes' },
  { label: 'Agenda', icon: 'calendar', href: '/agenda', match: ['/agenda'], barra: true, recurso: 'agenda' },
  { label: 'Formulários', icon: 'stack-2', href: '/formularios', match: ['/formularios'], recurso: 'formularios' },
  { label: 'Financeiro', icon: 'wallet', href: '/financeiro', match: ['/financeiro'], adminOnly: true, recurso: 'financeiro' },
  { label: 'Estoque', icon: 'building-warehouse', href: '/estoque', match: ['/estoque'], recurso: 'estoque' },
  { label: 'Staff', icon: 'users', href: '/staff/profissionais', match: ['/staff'], recurso: 'staff' },
  { label: ROTULOS.espacos, icon: 'building', href: '/espacos', match: ['/espacos'], recurso: 'espacos' },
  { label: 'Templates', icon: 'file-text', href: '/templates', match: ['/templates'], recurso: 'templates' },
  { label: 'Documentos', icon: 'signature', href: '/documentos', match: ['/documentos'], recurso: 'documentos' },
  { label: 'Pesquisas', icon: 'message-star', href: '/pesquisas', match: ['/pesquisas'], recurso: 'pesquisas' },
  { label: 'Banket Busca', icon: 'banket', href: '/busca', match: ['/busca'], recurso: 'busca', marca: 'busca' },
  { label: 'Configurações', icon: 'settings', href: '/configuracoes/empresa', match: ['/configuracoes'], adminOnly: true, recurso: 'configuracoes', hrefLivre: '/configuracoes/empresa' },
  { label: 'Suporte', icon: 'headset', href: '/suporte', match: ['/suporte'] },
];

/** Itens do menu para a sessão: filtra por papel e marca o que está fora do plano (`bloqueado` = recurso). */
// Configurações fora do plano (plano Busca) não fica com cadeado: abre em Configurações › Empresa (com o Financeiro).
export function itensDoMenu(
  admin: boolean,
  podeUsar: (recurso: Modulo) => boolean,
  itens: ItemNavegacao[] = NAV_PRINCIPAL
): (ItemNavegacao & { bloqueado: Modulo | null })[] {
  return itens
    .filter((item) => !item.adminOnly || admin)
    .map((item) => {
      const fora = Boolean(item.recurso && !podeUsar(item.recurso));
      if (fora && item.hrefLivre) return { ...item, href: item.hrefLivre, bloqueado: null };
      return { ...item, bloqueado: fora ? item.recurso! : null };
    });
}

/** Link de um item bloqueado: abre o painel de upsell na página inicial do plano. */
export const linkBloqueado = (recurso: string, inicio: string) => `${inicio}?bloqueado=${encodeURIComponent(recurso)}`;

export const navAtiva = (pathname: string, match: string[]) => match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

export const CONFIG_SUBMENU = [
  { id: 'empresa', label: 'Empresa', href: '/configuracoes/empresa' },
  { id: 'financeiro', label: 'Financeiro', href: '/configuracoes/financeiro' },
  { id: 'usuarios', label: 'Usuários', href: '/configuracoes/usuarios' },
  { id: 'categorias', label: ROTULOS.ocasioes, href: '/configuracoes/categorias' },
  { id: 'status', label: ROTULOS.etapas, href: '/configuracoes/status-orcamento' },
  { id: 'formatos', label: 'Formatos de serviço', href: '/configuracoes/formatos-servico' },
  { id: 'modelos-email', label: 'Modelos de e-mail', href: '/configuracoes/modelos-email' },
];

/** Submenu de Configurações para o plano: sem o recurso `configuracoes`, só Empresa e Financeiro (livres em todo plano). */
export const configSubmenuDoPlano = (temConfiguracoes: boolean) =>
  temConfiguracoes ? CONFIG_SUBMENU : CONFIG_SUBMENU.filter((i) => i.id === 'empresa' || i.id === 'financeiro');

export const CARDAPIO_SUBMENU = [
  // Na ordem em que se monta o catálogo: seção → itens → opções prontas
  { id: 'secoes', label: 'Seções', href: '/cardapio/secoes' },
  { id: 'itens', label: 'Itens do cardápio', href: '/cardapio/itens' },
  { id: 'opcoes', label: 'Opções de cardápio', href: '/cardapio/opcoes' },
  { id: 'categorias', label: 'Categorias', href: '/cardapio/categorias' },
];

export const ESTOQUE_SUBMENU = [
  { id: 'itens', label: 'Itens em estoque', href: '/estoque' },
  { id: 'movimentos', label: 'Movimentações', href: '/estoque/movimentos' },
];

export const FINANCEIRO_SUBMENU = [
  { id: 'geral', label: 'Visão geral', href: '/financeiro' },
  { id: 'receber', label: 'Contas a receber', href: '/financeiro/receber' },
  { id: 'pagar', label: 'Contas a pagar', href: '/financeiro/pagar' },
  { id: 'categorias', label: 'Categorias', href: '/financeiro/categorias' },
];

export const PESQUISAS_SUBMENU = [
  { id: 'geral', label: 'Visão geral', href: '/pesquisas' },
  { id: 'respostas', label: 'Respostas', href: '/pesquisas/respostas' },
  { id: 'perguntas', label: 'Por pergunta', href: '/pesquisas/perguntas' },
  { id: 'configurar', label: 'Questionário e e-mail', href: '/pesquisas/configurar' },
];

/** O questionário só é editado por owner/admin */
export const pesquisasSubmenu = (admin: boolean) => (admin ? PESQUISAS_SUBMENU : PESQUISAS_SUBMENU.filter((i) => i.id !== 'configurar'));

export const STAFF_SUBMENU = [
  { id: 'profissionais', label: 'Profissionais', href: '/staff/profissionais' },
  { id: 'servicos', label: 'Serviços e custos', href: '/staff/servicos' },
];

export const TEMPLATES_SUBMENU = [
  { id: 'templates', label: 'Templates', href: '/templates' },
  { id: 'blocos', label: 'Blocos de informação', href: '/templates/blocos' },
];

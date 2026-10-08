// Navegação principal e submenus compartilhados entre páginas de um mesmo módulo.
import { ROTULOS } from './rotulos';

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
}

// Uma só lista para a sidebar (desktop) e a barra inferior + painel "Mais" (celular)
export const NAV_PRINCIPAL: ItemNavegacao[] = [
  { label: 'Dashboard', icon: 'layout-dashboard', href: '/dashboard', match: ['/dashboard'], barra: true },
  { label: ROTULOS.funil, icon: 'layout-kanban', href: '/eventos', match: ['/eventos'], barra: true },
  { label: 'Inbox', icon: 'mail', href: '/inbox', match: ['/inbox'] },
  { label: 'Cardápios', icon: 'tools-kitchen-2', href: '/cardapio/secoes', match: ['/cardapio'] },
  { label: 'Clientes', icon: 'user-square', href: '/clientes', match: ['/clientes'], barra: true },
  { label: 'Agenda', icon: 'calendar', href: '/agenda', match: ['/agenda'], barra: true },
  { label: 'Formulários', icon: 'stack-2', href: '/formularios', match: ['/formularios'] },
  { label: 'Financeiro', icon: 'wallet', href: '/financeiro', match: ['/financeiro'], adminOnly: true },
  { label: 'Estoque', icon: 'building-warehouse', href: '/estoque', match: ['/estoque'] },
  { label: 'Staff', icon: 'users', href: '/staff/profissionais', match: ['/staff'] },
  { label: ROTULOS.espacos, icon: 'building', href: '/espacos', match: ['/espacos'] },
  { label: 'Templates', icon: 'file-text', href: '/templates', match: ['/templates'] },
  { label: 'Documentos', icon: 'signature', href: '/documentos', match: ['/documentos'] },
  { label: 'Pesquisas', icon: 'message-star', href: '/pesquisas', match: ['/pesquisas'] },
  { label: 'Configurações', icon: 'settings', href: '/configuracoes/usuarios', match: ['/configuracoes'], adminOnly: true },
  { label: 'Suporte', icon: 'headset', href: '/suporte', match: ['/suporte'] },
];

export const navAtiva = (pathname: string, match: string[]) => match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

export const CONFIG_SUBMENU = [
  { id: 'usuarios', label: 'Usuários', href: '/configuracoes/usuarios' },
  { id: 'categorias', label: ROTULOS.ocasioes, href: '/configuracoes/categorias' },
  { id: 'status', label: ROTULOS.etapas, href: '/configuracoes/status-orcamento' },
  { id: 'formatos', label: 'Formatos de serviço', href: '/configuracoes/formatos-servico' },
  { id: 'modelos-email', label: 'Modelos de e-mail', href: '/configuracoes/modelos-email' },
  { id: 'empresa', label: 'Empresa', href: '/configuracoes/empresa' },
];

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

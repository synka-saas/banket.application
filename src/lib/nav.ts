// Navegação principal e submenus compartilhados entre páginas de um mesmo módulo.
import { ROTULOS } from './rotulos';

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
  { label: 'Cardápios', icon: 'tools-kitchen-2', href: '/cardapio/secoes', match: ['/cardapio'] },
  { label: 'Clientes', icon: 'user-square', href: '/clientes', match: ['/clientes'], barra: true },
  { label: 'Agenda', icon: 'calendar', href: '/agenda', match: ['/agenda'], barra: true },
  { label: 'Formulários', icon: 'stack-2', href: '/formularios', match: ['/formularios'] },
  { label: 'Staff', icon: 'users', href: '/staff/profissionais', match: ['/staff'] },
  { label: 'Templates', icon: 'file-text', href: '/templates', match: ['/templates'] },
  { label: 'Configurações', icon: 'settings', href: '/configuracoes/usuarios', match: ['/configuracoes'], adminOnly: true },
  { label: 'Suporte', icon: 'headset', href: '/suporte', match: ['/suporte'] },
];

export const navAtiva = (pathname: string, match: string[]) => match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

export const CONFIG_SUBMENU = [
  { id: 'usuarios', label: 'Usuários', href: '/configuracoes/usuarios' },
  { id: 'tipos', label: ROTULOS.tiposEvento, href: '/configuracoes/tipos-evento' },
  { id: 'categorias', label: ROTULOS.ocasioes, href: '/configuracoes/categorias' },
  { id: 'status', label: ROTULOS.etapas, href: '/configuracoes/status-orcamento' },
  { id: 'formatos', label: 'Formatos de serviço', href: '/configuracoes/formatos-servico' },
  { id: 'locacao', label: 'Locação', href: '/configuracoes/locacao' },
  { id: 'empresa', label: 'Empresa', href: '/configuracoes/empresa' },
];

export const CARDAPIO_SUBMENU = [
  // Na ordem em que se monta o catálogo: seção → itens → opções prontas
  { id: 'secoes', label: 'Seções', href: '/cardapio/secoes' },
  { id: 'itens', label: 'Itens do cardápio', href: '/cardapio/itens' },
  { id: 'opcoes', label: 'Opções de cardápio', href: '/cardapio/opcoes' },
  { id: 'categorias', label: 'Categorias', href: '/cardapio/categorias' },
];

export const STAFF_SUBMENU = [
  { id: 'profissionais', label: 'Profissionais', href: '/staff/profissionais' },
  { id: 'servicos', label: 'Serviços e custos', href: '/staff/servicos' },
];

export const TEMPLATES_SUBMENU = [
  { id: 'templates', label: 'Templates', href: '/templates' },
  { id: 'blocos', label: 'Blocos de informação', href: '/templates/blocos' },
];

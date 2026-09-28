// Submenus compartilhados entre páginas de um mesmo módulo.
import { ROTULOS } from './rotulos';

export const CONFIG_SUBMENU = [
  { id: 'usuarios', label: 'Usuários', href: '/configuracoes/usuarios' },
  { id: 'tipos', label: ROTULOS.tiposEvento, href: '/configuracoes/tipos-evento' },
  { id: 'categorias', label: 'Categorias', href: '/configuracoes/categorias' },
  { id: 'status', label: ROTULOS.etapas, href: '/configuracoes/status-orcamento' },
  { id: 'formatos', label: 'Formatos de serviço', href: '/configuracoes/formatos-servico' },
  { id: 'locacao', label: 'Locação', href: '/configuracoes/locacao' },
  { id: 'empresa', label: 'Empresa', href: '/configuracoes/empresa' },
];

export const CARDAPIO_SUBMENU = [
  { id: 'itens', label: 'Itens do Cardápio', href: '/cardapio/itens' },
  { id: 'sessoes', label: 'Sessão do Cardápio', href: '/cardapio/sessoes' },
  { id: 'opcoes', label: 'Opções de Cardápio', href: '/cardapio/opcoes' },
];

export const STAFF_SUBMENU = [
  { id: 'profissionais', label: 'Base de Profissionais', href: '/staff/profissionais' },
  { id: 'servicos', label: 'Serviços e Custos', href: '/staff/servicos' },
];

export const TEMPLATES_SUBMENU = [
  { id: 'templates', label: 'Opções de Templates', href: '/templates' },
  { id: 'blocos', label: 'Blocos de Informação', href: '/templates/blocos' },
];

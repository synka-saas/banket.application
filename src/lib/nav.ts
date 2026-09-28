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
  // Na ordem em que se monta o catálogo: seção → itens → opções prontas
  { id: 'secoes', label: 'Seções', href: '/cardapio/secoes' },
  { id: 'itens', label: 'Itens do cardápio', href: '/cardapio/itens' },
  { id: 'opcoes', label: 'Opções de cardápio', href: '/cardapio/opcoes' },
];

export const STAFF_SUBMENU = [
  { id: 'profissionais', label: 'Profissionais', href: '/staff/profissionais' },
  { id: 'servicos', label: 'Serviços e custos', href: '/staff/servicos' },
];

export const TEMPLATES_SUBMENU = [
  { id: 'templates', label: 'Templates', href: '/templates' },
  { id: 'blocos', label: 'Blocos de informação', href: '/templates/blocos' },
];

# Banket app — UI kit

Recriação clicável e **refinada** do web app Banket (desktop). A estrutura, a navegação, o conteúdo e os fluxos seguem as capturas de tela de produção (`uploads/*.png`); a pele visual aplica o refresh (General Sans 400/500, terracota + argila, sentence case, raios suaves).

Abra `index.html`. Clique na sidebar para navegar; a página atual persiste em `localStorage` (`bk-kit-page`).

## Telas
| Arquivo | Tela | Interações |
|---|---|---|
| `DashboardScreen.jsx` | Dashboard — KPIs, Funil por etapa, Retornos, Próximos 30 dias | links para Funil e Agenda |
| `FunilScreen.jsx` | Funil de vendas — Kanban e Lista | busca, toggle Lista/Kanban, ordenação, menu "⋯" dos cards |
| `AgendaScreen.jsx` | Agenda — mês | navegar meses, Hoje, Mês/Semana |
| `CardapiosScreen.jsx` | Cardápios — Seções, Itens, Opções, Categorias | abas, paginação, reordenar |
| `ClientesScreen.jsx` | Clientes + drawer "Novo cliente" | busca, ordenação, criar cliente (validação do nome) |
| `FormulariosScreen.jsx` | Formulários (cards) + editor com seções | Editar → editor, ativar/desativar seções, ActionBar "Alterações não salvas" |
| `ConfiguracoesScreen.jsx` | Configurações — Usuários, Tipos, Ocasiões, Etapas, Formatos, Locação, Empresa | todas as abas |
| `SuporteScreen.jsx` | Suporte — empty state + drawer "Novo chamado" | abrir chamado → aparece na tabela |
| `MoreScreens.jsx` | Staff/Profissionais (+ drawer) e Templates | |
| `Shell.jsx` | `AppShell` (Sidebar + AppHeader + Tabs + conteúdo) | |
| `data.js` | Dados fictícios espelhando as telas | |

## Fora do escopo
- Editor de orçamento / proposta (não havia captura).
- Editor de template de PDF completo (só a listagem foi recriada).
- Respostas de formulário e Serviços e custos (abas existem; conteúdo não recriado).

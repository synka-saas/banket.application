# Banket — Design System

> Sistema de gestão para buffets e casas de eventos. Este design system é a **versão refinada** da interface atual: mesma estrutura e identidade, com tipografia mais leve (General Sans), paleta terracota/argila quente e componentes revisados.

## Contexto do produto

**Banket** é um SaaS multi-empresa (multi-tenant) para buffets e casas de eventos. Cobre:

- **Captação do pedido** — formulário público (`app.banket.com.br/f/<slug>`) ou cadastro manual.
- **Funil de vendas** — quadro Kanban (Novo orçamento → Em negociação → Aprovado / Recusado) e visão Lista.
- **Orçamento versionado** montado a partir do catálogo: cardápios (seções, itens, opções, categorias), bebidas, staff, locação do espaço.
- **Proposta em PDF** gerada por templates (capa, páginas de conteúdo, contracapa) e enviada por e-mail.
- **Agenda**, **Dashboard**, **Clientes**, **Staff/Profissionais**, **Configurações** (usuários, tipos de evento, ocasiões, etapas do funil, formatos de serviço, locação, empresa) e **Suporte** (chamados).

Superfície única: **web app desktop** (sidebar + header + conteúdo). Público: donos e equipe comercial de buffets (pt-BR).

## Fontes fornecidas

Nenhum código-fonte ou Figma foi anexado. A base foi:

- 27 capturas de tela da aplicação atual (`uploads/*.png`): dashboard, kanban, lista, agenda, cardápios (seções/itens/opções/categorias), clientes (+ drawer), formulários (lista/edição/respostas), profissionais (+ drawer), templates (lista/edição), configurações (usuários, tipos de evento, ocasiões, etapas, formatos, locação, empresa), suporte (+ drawer).
- Logo oficial `uploads/logo-dark.png` → `assets/logo-dark.png`.
- Família **General Sans** (Indian Type Foundry / Fontshare), 200–700 + itálicos → `assets/fonts/`.
- Diretriz do cliente: *manter a interface e o logo, refinar; fontes mais finas; terracota e cores quentes que remetam a cerâmica, calor e acolhimento.*

Valores do legado (amostrados das telas): marca `#E35336`, botão primário `#C74229`, links/títulos `#B0351C`, sidebar `#FFF0EB`, fundo `#F7F7F7`, bordas `#E2E2E2`, cabeçalho de tabela `#EEEEEE`, fonte tipo Open Sans com bolds pesados, CAIXA ALTA em botões/labels, raios 3–4px, ícones Tabler.

---

## CONTENT FUNDAMENTALS

**Idioma:** português do Brasil, sempre. Termos do setor: *evento, orçamento, proposta, cardápio, convidados, degustação, serviço volante, empratado, ilhas gastronômicas, staff, locação*.

**Voz:** prática, calorosa e direta — um gerente experiente explicando o sistema a um colega. Explica *o porquê* em uma frase curta abaixo do título ou da tabela:
- "Indicadores dos pedidos que entraram no período escolhido. Os valores vêm do orçamento mais recente de cada evento."
- "Cada etapa é uma coluna do **Funil de vendas**, na ordem abaixo."
- "O valor da locação entra automaticamente no orçamento conforme o número de convidados do evento."

**Pessoa:** o sistema fala com o usuário em **você** implícito, quase sempre no imperativo ou impessoal ("Registre anotações…", "Clique para inserir no campo"). Saudação pelo primeiro nome: "Olá, Leandro". Na voz do buffet para o cliente final (formulários, e-mails), **nós** ("Precisamos entender o espaço…", "Agradecemos o interesse…").

**Caixa:** *sentence case* em tudo — títulos, botões, labels, abas, tags. ✅ "Novo evento", "Exportar CSV", "Nome / razão social". ❌ "NOVO EVENTO". (O legado usava caixa alta em botões e labels; o refinamento aposenta isso.) Exceção: **eyebrows** (rótulos de KPI, grupos) em caixa alta 11px com tracking 0.08em.

**Botões:** verbo + objeto: "Novo cliente", "Convidar usuário", "Abrir chamado", "Salvar intervalo". Ações de linha com um verbo: "Editar", "Abrir", "Excluir", "Ver resposta".

**Estados vazios:** "Nenhum {coisa}" + o que fazer: "Nenhum chamado aberto — Quando precisar de ajuda, abra um chamado: a conversa com o suporte fica registrada aqui."

**Metadados:** separador ponto médio ` · ` ("1 aprovados · 0 recusados", "29/10/2026 · Quinta-feira · 11:00 · 50 convidados"). Escopo entre parênteses: "Principal (tipo)", "Social (B2C)".

**Formatos:** moeda `R$ 9.250,00`; data `dd/mm/aaaa`; hora `11:00`; contagens zero-padded em cards/colunas (`05 eventos`, `Seções 09`); valor vazio = travessão `—` em cinza claro (o legado usava `-`).

**Emoji:** não. Nunca em UI. Ícones são Tabler.

**Exemplos de microcopy:** "há 11 dias nesta etapa" · "Tudo salvo" · "Sempre ativa" · "Recebendo respostas" · "Usado nos templates de orçamento." · "Eventos sem data definida não aparecem na agenda."

---

## VISUAL FOUNDATIONS

**Vibe:** ateliê de cerâmica — papel quente, argila, terracota queimada, esmaltes discretos. Calmo, acolhedor, profissional. Nada de neon, gradiente agressivo ou cinza frio.

**Cor**
- **Terracota** (`--terracotta-50…900`) ancorada no logo `#E35336` (500). Ação primária 600 `#C9432A`; links e acentos de texto 700 `#A9361F`; tints 50/100 para fundos de destaque.
- **Argila** (`--clay-0…900`) — neutros quentes que substituem os cinzas frios do legado. Fundo do app `clay-50 #FAF6F2`, cards brancos, bordas `clay-200`, texto `clay-700` / títulos `clay-800–900`.
- **Esmaltes** de apoio: sálvia (sucesso/aprovado), ocre (atenção), cobalto (info/corporativo), vinho (erro). Usados em tags, badges e gráficos — nunca como cor de marca.
- **Etapas do funil:** `--stage-new` (clay-400), `--stage-negotiation` (terracota), `--stage-won` (sálvia), `--stage-lost` (clay-800).
- Proporção: ~85% neutros quentes, ~10% terracota, ~5% esmaltes. Um único botão primário por região.

**Tipografia:** General Sans, família única. Pesos **400** (texto) e **500** (UI, títulos) — o refinamento troca os bolds 700 do legado por 500. 600 só em casos pontuais; 300 apenas em display grande. Corpo 14px/1.5; títulos de página 20px; saudação 24px; KPI 28–32px com tracking −0.02em e numerais tabulares. Labels 13px/500 em sentence case. Mono do sistema só para variáveis `{nome_cliente}` e hex.

**Espaçamento:** base 4px (`--space-1…16`). Conteúdo com padding 28/32px; gaps de grid 16–20px; campos de formulário em grid `16px 20px`. Densidade média — tabelas com linhas de 52px.

**Fundos:** cor sólida. Sem imagens full-bleed, padrões, texturas ou gradientes na UI do app. A sidebar usa um tint quente (`--bg-sidebar #FBF1EC`) para separar navegação de conteúdo. (Os PDFs de proposta, sim, usam imagens de fundo — configuradas por cada buffet.)

**Cantos:** suavizados em relação ao legado (3–4px) para conversar com o ícone arredondado do logo: inputs/botões 8px, cards/tabelas 12px, tags 6px, badges/switches pill.

**Cards:** fundo branco, borda 1px `clay-200`, raio 12px, sombra `--shadow-xs`. Cabeçalho com ícone em tile terracota-50 + título 15px/500 + descrição 13px muted. Hover em cards clicáveis: borda `clay-300` + `--shadow-md` (+1px de lift em cards de kanban).

**Sombras:** quentes (rgba de `clay-900`), suaves e curtas: `xs` cards, `sm` controles, `md` hover, `lg` popovers/action bar, `xl` drawers. Sem sombras internas fortes; `--shadow-inset` só em trilhos de switch e swatches.

**Bordas:** hairlines 1px. Três níveis: `subtle` (divisórias de linha), `default` (cards), `strong` (inputs, botões secundários). Foco: borda terracota-500 + anel `--focus-ring` (3px, 20% terracota).

**Hover:** escurece um passo (primário 600→700), fundo `clay-100` em ghost/ícones, wash de 6% terracota na sidebar, `clay-25` em linhas de tabela. Links ganham sublinhado fino (offset 3px).
**Press:** escurece mais um passo + `translateY(.5px)`. Sem scale/shrink.

**Movimento:** discreto e funcional. `--ease-out cubic-bezier(.2,.7,.2,1)`; 120ms (cor/hover), 180ms (switch, menus), 280ms (drawer desliza 24px + fade). Sem bounces, sem animações decorativas.

**Transparência e blur:** apenas no scrim do drawer (`--bg-overlay` = tinta quente 44% + blur 2px) e na `ActionBar` flutuante (branco 92% + blur 8px).

**Layout:** sidebar fixa 248px · header 64px · sub-navegação (Tabs) 48px · conteúdo rolável em `--bg-app`. Toolbar padrão: busca + filtros à esquerda, ações à direita com o primário por último. Drawers à direita (560px) para criar/editar; salvar no cabeçalho do drawer.

**Imagens:** só as do cliente (logotipo do buffet, fundos dos templates — o padrão é botânico/aquarela claro). Tom quente; nunca frias ou P&B na UI.

---

## ICONOGRAPHY

- **Sistema:** [Tabler Icons](https://tabler.io/icons) (MIT), estilo *outline*. Identificado nas telas (ex.: `layout-dashboard`, `layout-kanban`, `tools-kitchen-2`, `stack-2`, `headset`, `building`).
- **Entrega:** 86 ícones copiados programaticamente do pacote oficial `@tabler/icons@3.19.0` para `components/core/iconPaths.js` e renderizados inline pelo componente `<Icon name="…" />` (herda `currentColor`). Para novos ícones, copie o path do mesmo pacote para `iconPaths.js`.
- **Traço:** **1.5** (refinado; o legado usava 2) — combina com os pesos mais leves da General Sans. 1.75 em ícones ≤16px.
- **Tamanhos:** 16 (botões, inline), 18 (padrão), 20 (sidebar), 22–26 (estados vazios).
- **Cor:** `clay-600` em repouso; terracota-600 quando ativo ou em tiles de destaque (cards, empty states).
- **Ícones-chave da navegação:** Dashboard `layout-dashboard` · Funil `layout-kanban` · Cardápios `tools-kitchen-2` · Clientes `user-square` · Agenda `calendar` · Formulários `stack-2` · Staff `users` · Templates `file-text` · Configurações `settings` · Suporte `headset`. Pessoa física `user-square` vs. empresa `building`.
- **Sem emoji, sem caracteres unicode como ícone, sem PNGs de ícone.**

---

## Index

| Caminho | Conteúdo |
|---|---|
| `styles.css` | Entrada global — apenas `@import`s |
| `tokens/` | `fonts.css` (@font-face General Sans), `colors.css`, `typography.css`, `spacing.css` (espaço, raios, sombras, movimento, layout), `base.css` |
| `components/<grupo>/` | Componentes React (`.jsx` + `.d.ts` + `.prompt.md`), CSS do grupo e um `*.card.html` |
| `guidelines/` | Cards de fundamentos (cores, tipo, espaçamento, marca) |
| `ui_kits/banket-app/` | Recriação clicável do app (refinada) |
| `assets/` | `logo-dark.png`, `logo-light.png` (wordmark branco, derivado), `logo-mark.png` (recorte do tile), `fonts/` |
| `thumbnail.html` | Tile do design system |
| `SKILL.md` | Manifesto para uso como Agent Skill |

### Components

Namespace do bundle: `window.BanketDesignSystem_f9651f`.

- **core:** Icon, Button, IconButton, SegmentedControl, Avatar, Logo
- **forms:** Field, TextInput, Select, Textarea, Checkbox, Switch, ColorInput, FileField, VariableChip
- **data:** Table, Pagination, Tag, StatusBadge, StageDot, ProgressBar, InfoList, StatCard
- **layout:** Card, Toolbar, EmptyState, CopyField, ActionBar
- **navigation:** Sidebar (+ `BANKET_NAV`), AppHeader, UserMenu, Tabs, BackLink
- **overlay:** Drawer, Menu
- **domain:** KanbanColumn, EventCard, CatalogCard, CalendarMonth, FunnelBreakdown, AgendaItem, ReorderControls, FormSection

### Intentional additions

- **Icon** — wrapper para o set Tabler copiado (necessário para renderizar os ícones).
- **Menu** — o "⋯" dos cards de kanban e o chevron do usuário existem nas telas, mas o menu aberto não; desenhado conforme os tokens.
- **ActionBar** — refina a barra "Tudo salvo · Pré-visualizar · … · Salvar" do editor de formulários em uma barra flutuante reutilizável.
- **AgendaItem** — substitui o bloco com borda esquerda de "Próximos 30 dias" por um tile de data.
- **Toolbar**, **CopyField**, **FileField** — formalizam padrões repetidos nas telas (busca+filtros+ações; link público; "Logotipo atual · Trocar · Remover").

### UI kit

`ui_kits/banket-app/` — Dashboard, Funil de vendas (Kanban/Lista), Agenda, Cardápios, Clientes (+ drawer), Formulários (+ editor), Configurações (Etapas, Empresa), Suporte (+ drawer). Ver `ui_kits/banket-app/README.md`.

# Yosp Design System

**Yosp** é um SaaS multi-tenant de gestão operacional de imóveis de locação por temporada. Atende **gestores de imóveis** (proprietário da conta, administradores, anfitriões, donos de imóvel) e seus **prestadores de serviço** (faxina, zeladoria, manutenção). O produto organiza a operação do dia: agenda de faxinas por imóvel e por prestador, checklists por cômodo com fotos obrigatórias, equipe em campo, permissões por perfil, faturamento da assinatura.

Este design system aplica uma **nova linguagem visual** (o "padrão visual sugerido") às telas reais do Yosp:

- **Estrutura, conteúdo e fluxos** vêm das telas atuais do sistema (`uploads/dashbaord.png`, `agendamentos*.png`, `imoveis.png`, `checklists*.png`, `prestadores.png`, `tipos-servicos.png`, `conta-*.png`, `meu-perfil.png`, `login.png`).
- **Estética** vem da referência "DataNest" (`uploads/01.png` – `10.png`, um case de dashboard analítico): tipografia leve, superfícies brancas com hairline #E6E6E6, sidebar sobre cinza #F5F7F9, item ativo sólido, cards de 14px sem sombra, KPIs grandes em peso 500, laranja + amarelo como acentos.
- **Marca** vem dos arquivos Yosp: `uploads/logo-azul.svg`, `logo-branco.svg`, `icon-principal.png` → azul **#1652F9** substitui o roxo da referência em todo o sistema.

Fontes recebidas: apenas imagens + logos (sem Figma, sem código). Todos os valores foram medidos/amostrados das imagens.

---

## Index

| Caminho | O quê |
|---|---|
| `styles.css` | Entrada global (só `@import`s) |
| `tokens/` | `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `fonts.css`, `base.css` |
| `components/` | Primitivos React (ver lista abaixo), um card `@dsCard` por pasta |
| `guidelines/` | Cards de fundação: cores, tipo, espaçamento, raios, elevação, shell, marca, iconografia |
| `ui_kits/yosp-web/` | Recriação clicável do painel do gestor (18 telas) |
| `fonts/` | General Sans (woff2/woff/ttf, 200–700 + itálicos) |
| `assets/` | `logo-azul.svg`, `logo-branco.svg`, `logo-preto.svg`, `icon-yosp.png`, `login-photo.jpg` |
| `uploads/` | Material original (telas atuais + referência visual) |
| `SKILL.md` | Manifesto de skill (Claude Code / Agent Skills) |
| `thumbnail.html` | Tile do projeto |

### Components
- **brand/** — `Logo`, `Icon`
- **actions/** — `Button`, `IconButton`
- **forms/** — `Input`, `Select`, `Switch`, `SettingRow`
- **data-display/** — `Card`, `StatCard`, `Table`, `ListItem`, `IconTile`, `Badge`, `Pill`, `Avatar`, `UserChip`, `ProgressBar`, `Legend`
- **navigation/** — `Sidebar`, `NavItem`, `Topbar`, `SegmentedControl`, `Tabs`, `PageHeader`, `Pagination`
- **feedback/** — `Banner`, `EmptyState`, `FeedItem`, `Stepper`

Intentional additions (não existem como peça isolada nas telas, mas são necessárias):
- `Icon` — wrapper do Lucide (CDN) para padronizar traço 1.5 e currentColor.
- `Logo` — renderiza os paths oficiais do SVG para não depender de caminho relativo.
- `IconTile` — o quadrado tingido com ícone que aparece em várias telas (checklists, logística, suporte) virou primitivo.

### UI kit — `ui_kits/yosp-web/index.html`
Dashboard (Operação de hoje) · Agenda: lista, semana por imóvel, semana por prestador · Imóveis (grid) · Checklists (lista + edição) · Prestadores · Tipos de serviço · Minha conta: Dados, Faturamento, Usuários, Logística, Permissões, Atividades, Suporte · Meu perfil · Login. Navegação por hash (`#conta/usuarios`, `#login`).

---

## CONTENT FUNDAMENTALS

- **Idioma:** português do Brasil, sempre. Datas `01/10`, `28 set – 4 out 2026`; moeda `R$ 89,90`; decimais com vírgula (`82,3%`, `4,2`).
- **Voz:** operacional, direta, calma. Fala com o gestor por **"você / sua conta"** ("Gerencie os profissionais vinculados à sua conta"). Nunca "nós fizemos"; a empresa só aparece em Suporte ("nossa equipe").
- **Subtítulos de página** começam com verbo no imperativo: *Gerencie…, Configure…, Visualize e gerencie…, Acompanhe…, Escolha…*
- **Casing:** *sentence case* em tudo — títulos, botões, badges, cabeçalhos de tabela ("Novo agendamento", "Aguardando confirmação", "Nível de acesso"). O sistema atual usa Title Case e CAIXA ALTA em badges/labels; no novo padrão isso foi removido (a referência usa caixa normal e peso, não caps, para hierarquia). Exceção: nomes próprios e siglas (PIX, CPF, CNPJ, UF, 2FA).
- **Botões:** verbo + objeto, curto: *Novo agendamento, Adicionar prestador, Salvar alterações, Exportar dados filtrados, Abrir agenda*. Links secundários: *Ver agenda, Ver, Alterar plano*.
- **Status** são particípios/estados curtos: *Confirmado, Aguardando confirmação, Pendente, Atrasada, Em andamento, Concluída, Ativo, Sem acesso*.
- **Vazios** explicam o que vai aparecer: "Nenhuma faxina concluída hoje" + "As avaliações aparecem aqui assim que a primeira faxina terminar."
- **Números contam a história:** KPI grande + legenda curta de contexto ("+39 min de atraso", "0 de 8 faxinas").
- **Emoji:** nunca. **Pontuação decorativa:** usar `·` como separador de metadados e `—` para vazio.
- **Editorial/marketing** (fora do produto): título em duas tonalidades — primeira linha cinza leve, segunda em tinta ("Toda a operação dos seus imóveis / em um só lugar.").

## VISUAL FOUNDATIONS

- **Cor.** Azul Yosp `#1652F9` é a única cor de marca: botão primário, item de navegação ativo, links, ícones de KPI, foco. Escada de tints por mistura com branco (10/20/30/50%) = `--blue-50/100/200/300`, igual à lógica da referência. Acentos herdados da referência: **laranja `#D86809`** e **amarelo `#EDC04D`** — usados em dados (séries 2 e 3) e estados (em andamento, pendente). Negativo `#A66158` sobre `#F6EFEE` (amostrado). Verde `#1F9D55` foi acrescentado porque o Yosp precisa de "Ativo/Concluída". Neutros: tinta `#13101C`, muted `#6A6C6D`, hairline `#E6E6E6`, cinza de app `#F5F7F9`.
- **Tipografia.** **General Sans** (auto-hospedada em `fonts/`, `@font-face` em `tokens/fonts.css`). Produto usa Light 300 / Regular 400 / Medium 500; Semibold/Bold ficam reservados. A referência usava SF Pro; a marca Yosp usa General Sans. Hierarquia por tamanho e peso 500 — nunca bold pesado, nunca caixa alta. Título de página 24/500, título de card 20/500, KPI 28/500, corpo 16, labels/cabeçalhos de tabela 14 muted, badges 12/500. Números com `tabular-nums`.
- **Layout.** Sidebar de 240px direto sobre o cinza do app; conteúdo num **painel branco** inset 16px (topo e direita) com cantos superiores de 16px e hairline. Header de 80px dentro do painel com borda inferior. Conteúdo com padding 24, grid gap 20, largura máx. 1360.
- **Cards.** Branco, `1px #E6E6E6`, raio 14, **sem sombra**, padding 24 (16 nos KPIs). Cabeçalho = título 20/500 + contagem muted "(8)" + ação à direita (select, ícone ⋮, busca).
- **Raios.** 6 badge · 10 botão/input/nav/banner · 14 card · 16 painel · 20 composer · 32 card de vidro editorial · full em pills e avatares.
- **Sombras.** Produto é plano. `--shadow-xs` só no segmento ativo do SegmentedControl; `--shadow-pop` em menus/popovers. Sem sombra interna.
- **Bordas.** Hairline 1px em tudo (cards, inputs, botões secundários, linhas de tabela quando `divided`). Estado selecionado = borda azul + anel de 1px azul (não preenchimento).
- **Fundos.** Produto: cinza liso + branco, sem gradientes, sem textura. Editorial: canvas em gradiente suave (cinza → azul muito claro, `--gradient-canvas`) com cards de vidro translúcidos (`--gradient-glass-card`, borda branca 70%, blur 20px).
- **Imagens.** Fotos reais de interiores, luz natural, materiais quentes (ver `assets/login-photo.jpg`). Em peças editoriais pode-se aplicar véu azul (`--gradient-photo-wash`) e uma pílula de vidro com legenda por cima. Mapas são do Google Maps (placeholder no kit).
- **Hover.** Fundos ganham um passo: botão primário 500→600, secundário/ghost → `--gray-50`, linha de tabela clicável → `--gray-50`, card clicável → borda `--gray-300`. **Press:** primário → 700. Sem scale/shrink, sem brilho.
- **Foco.** Borda azul + `--focus-ring` (3px azul 25%).
- **Movimento.** Discreto e funcional: 120ms para cor/fundo, 200ms para switches, 320ms para barras de progresso; easing `cubic-bezier(.2,.8,.2,1)`. Sem bounce, sem animações decorativas.
- **Transparência/blur.** Só no editorial (vidro) e no wash de foto. Nunca em superfícies do produto.
- **Dados.** Barras empilhadas com segmentos arredondados separados por 4px; séries em ordem azul → laranja → amarelo → azul-200; trilho de progresso `--blue-50`; grid tracejado `#E6E6E6`.
- **Densidade.** Arejada: linhas de tabela ~56px, itens de nav 48px, controles 40/48px.

## ICONOGRAPHY

- **Conjunto:** [Lucide](https://lucide.dev) via CDN (`lucide-static@0.469.0`), outline, traço **1.5**, `currentColor`. A referência usa um set linear fino (estilo Iconsax/Linear) e o Yosp atual usa outro set de contorno — Lucide é a substituição mais próxima disponível em CDN. ⚠️ Substituição sinalizada.
- **Uso:** sempre via `<Icon name="…" />`. 20px em nav/botões, 14–16px em metadados, 22px no canto de StatCards (cor do tom), 40–56px dentro de `IconTile` grande.
- **Mapeamento Yosp:** Dashboard `layout-grid` · Agenda `calendar-days` · Imóveis `building-2` · Prestadores `wrench` · Minha conta `circle-user-round` · faxina `spray-can` · fotos `camera` · prestador `user-round` / sem prestador `user-x` · atraso `triangle-alert` · concluída `circle-check` · assistente `sparkles` · mensagens `message-square-text`.
- **Sem emoji, sem caracteres unicode como ícone, sem PNGs de ícone.** Logos de terceiros (Google, PIX) não são redesenhados: botão "Continuar com Google" fica só em texto; PIX usa `qr-code`.
- **Logo:** `assets/logo-*.svg` (círculo + "yosp") e `assets/icon-yosp.png` (app icon). Os SVGs originais vieram sem a regra de cor (`.st0` sem estilo); as cópias em `assets/` só reinserem o preenchimento (azul `#1652F9`, branco, tinta).

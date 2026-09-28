# Banket — Plano de atuação em UX e UI

**Data:** 28/09/2026 · **Base:** [report-ux&ui.md](report-ux&ui.md) (`main` @ `f485bad`) · Cobre todos os itens UX-001 a UX-154 e a seção 4 do relatório.

## Como ler este plano

- O trabalho está em **5 fases**. A **fase 0** cria peças compartilhadas (formulário assíncrono no drawer, toast,
  modal de confirmação, máscaras, tokens de cor, glossário) que resolvem vários itens de uma vez. As fases 1 a 4
  seguem as ondas do relatório.
- Cada item traz **o que muda**, **onde** e **como saber que está pronto** (critério de aceite).
- Esforço em dias de uma pessoa: **P** ≤ 0,5 · **M** 1–2 · **G** 3–5.
- Cada fase termina em um deploy próprio (blue-green), com `npm test`, `npx astro check`, `npm run build` e os e2e
  afetados passando.

### Andamento (28/09/2026, tudo publicado em produção, e2e 29/29)

| Fase | Situação |
|---|---|
| 0 — Fundações | **Concluída**: F1 drawer por fetch com erros por campo, F2 toast, F3 modal de confirmação, F4 máscaras, F5 contraste/foco/alvos, F6 carregando, F7 glossário |
| 1 — Correções críticas | **Concluída**: UX-001, 002, 003, 010, 011, 012, 100, 101, 103, 112, 120, 121, 150, 160 |
| 2 — Consistência | **Concluída**: UX-004–009, 013–019, 020–029, 050, 113, 124, 125, 140, 141, 144, 145, 149, 153 (+ UX-067 pelo menu Mover para) |
| 3 — Acessibilidade e celular | **Concluída** (28/09): UX-030 (barra inferior, cartões, funil por etapa, drawers em tela cheia), UX-063, UX-064, UX-067, UX-102 (no celular). Adiados para não alterar o visual do desktop (pedido do usuário): UX-066 (legenda da agenda) e o card compacto do desktop |
| 4 — Fluxos | **Concluída** (28/09): 4.1 UX-041–047 · 4.2 UX-050–053 · 4.3 UX-070–079 · 4.4 UX-104–117 · 4.5 UX-122–130 · 4.6 UX-090–093 · 4.7 UX-142–154. Fora: UX-094 (visão lista/iCal da agenda), UX-092 (KPIs clicáveis/variação) e a seção 4.8 (oportunidades), que seguem como backlog. UX-076 entregue como prévia da versão salva (painel lado a lado fica como evolução) |

Decisões aplicadas com a recomendação: D1 glossário, D2 congelar ao enviar, D3 título do card, D5 hora extra oculta,
D7 ordem por data. D4, D6 e D8 entram nas fases 3–4.

---

## Decisões pendentes

Precisam de resposta antes da fase indicada. Cada uma já traz uma recomendação; sem objeção, ela é seguida.

| # | Decisão | Recomendação | Afeta | Fase |
|---|---|---|---|---|
| D1 | Glossário do domínio (UX-020) | **Tipo** (Social/Corporativo) · **Ocasião** (Casamento, Aniversário…) · **Formato de serviço** (Buffet, Coquetel…) · **Estilo gastronômico** (estilo principal/secundário) · **Etapa** (coluna do funil; em Configurações, "Etapas do funil") · módulo **"Funil de vendas"** | Formulários, card, resumo, filtros, configurações, CSV, formulário público | 0 |
| D2 | O que acontece ao enviar a proposta (UX-120) | Congelar a versão enviada e abrir a N+1 automaticamente, com aviso "A versão 02 foi enviada e congelada; você está editando a versão 03" | Envio e histórico de versões | 1 |
| D3 | Título do card do painel de autenticação (UX-001) | O texto enviado não tem título para o card. Sugestão: ícone `insights` + "Gestão comercial para buffets". Alternativa: card sem título | `AuthLayout.astro` | 1 |
| D4 | "Teste grátis por 30 dias" no cadastro e no login (UX-046) | Trocar por "Crie sua conta" até o trial existir (report.md FUN-02) | Telas de autenticação | 1 |
| D5 | Hora extra do staff (UX-141) | Esconder o campo e o valor no card até existir o cálculo; o dado segue gravado | Staff › Serviços | 2 |
| D6 | "Local padrão dos eventos" (UX-152) | Usar como valor inicial de `local_nome` em evento novo com local "casa" | Empresa e formulário do evento | 4 |
| D7 | Ordem manual no Kanban (UX-103) | Não salvar ordem: soltar sempre na posição da data (sem migration) | Kanban | 1 |
| D8 | Alcance do mobile (UX-030) | Tudo navegável no celular; construtor de orçamento e editor de template **legíveis e operáveis**, mas otimizados para desktop | Fase 3 | 3 |

---

## Fase 0 — Fundações compartilhadas (≈ 1,5 semana)

Peças que várias correções usam. Cada uma entra sem mudar o comportamento visível até ser ligada nas telas.

### F1 — Drawer com envio assíncrono e erros por campo · G
**Resolve:** UX-010, UX-014 (drawers), base de UX-017 e UX-070.

- `Drawer.astro` intercepta o `submit` do form ligado a ele e envia por `fetch` com `Accept: application/json`
  (mesma URL, mesmo `FormData`, então o `checkOrigin` do Astro continua valendo). Sem JavaScript, o POST normal segue
  funcionando.
- `lib/actions.ts`: `handleFormPost` detecta `Accept: application/json` e responde `{ ok, message, redirect }` ou
  `{ ok: false, error, fields: { campo: mensagem } }` em vez de redirecionar.
- `lib/forms.ts`: nova `fieldErrors(err)` que transforma o `ZodError` em `{ campo: mensagem }`; `UserError` ganha um
  `campo` opcional (ex.: e-mail duplicado de cliente aponta para `email`). O `23505` continua genérico quando não se
  sabe o campo.
- No sucesso: grava o flash (cookie) e recarrega a página (`location.assign(redirect)`), mantendo o PRG atual. No
  erro: painel continua aberto, mensagem no topo do drawer + texto sob cada campo (`.field-erro`, `aria-invalid`,
  `aria-describedby`), foco no primeiro campo com erro.
- **Alterações não salvas:** o drawer guarda um instantâneo do form ao abrir; Esc, clique fora e ✕ pedem
  confirmação (modal da F3) se houver diferença.
- **Telas afetadas (12):** `cardapio/itens`, `cardapio/sessoes`, `clientes/index`, `configuracoes/{categorias,
  formatos-servico, locacao, status-orcamento, tipos-evento, usuarios}`, `eventos/[id]/orcamento` (envio),
  `staff/{profissionais, servicos}`. `clientes/index.astro` ainda não usa `handleFormPost`: migrar primeiro.
- **Aceite:** em cada tela, salvar um CPF inválido ou nome duplicado mantém o drawer aberto com o erro no campo e
  tudo o que foi digitado; salvar certo fecha e mostra o toast. E2e novo em `tests/e2e/seguranca.spec.ts` ou
  `clientes`: "erro de validação preserva o drawer".

### F2 — Toast v2 · P
**Resolve:** UX-012; base do "Desfazer" (UX-019, UX-104, UX-117, UX-160).

- `Toast.astro`: erro com `role="alert"`, **persistente** até fechar, botão ✕ (`aria-label="Fechar"`); sucesso e
  info somem em 5 s e pausam com o mouse em cima.
- Posição **inferior direita** (não cobre os botões do cabeçalho do drawer); no celular, largura total embaixo.
- API: `banketToast(msg, tipo, { acao?: { rotulo, executar } })` para o "Desfazer".
- **Aceite:** erro fica na tela até o ✕; leitor de tela anuncia o erro; nenhum toast cobre "Salvar" com drawer aberto.

### F3 — Modal de confirmação · M
**Resolve:** UX-019; usado em UX-014, UX-104, UX-120, UX-149, UX-160.

- Componente `ui/Confirmar.astro` + `window.banketConfirmar({ titulo, texto, confirmar, perigo })` que retorna
  `Promise<boolean>`. `<dialog>` nativo (foco preso e Esc de graça).
- O atributo `data-confirm` existente passa a usar o modal (troca do `window.confirm` num lugar só).
- Exclusões com impacto informam a contagem: "Excluir a seção Salgados? **12 itens** serão excluídos junto."
  (`server/cardapio.ts` ganha `contarItensSecao`; o drawer recebe a contagem em `data-values`).
- **Aceite:** nenhuma chamada a `window.confirm` restante (`grep`); excluir seção mostra a quantidade de itens.

### F4 — Máscaras reutilizáveis · M
**Resolve:** UX-016, UX-073; parte de UX-042.

- `lib/mascaras.ts` (puro, com testes): `documento(tipo)` (já existe em `lib/documento.ts`), `telefone` (10 ou 11
  dígitos: "(11) 3333-4444" / "(11) 93333-4444"), `cep`, `dinheiro` (formato `money.ts`).
- Atributo `data-mascara="cpf|cnpj|documento|telefone|cep|dinheiro"`; `documento` segue um select de tipo informado
  em `data-mascara-tipo`. Um script único no `Layout.astro` liga todos os campos.
- Aplicar em: evento (documento, telefone, WhatsApp, verba), clientes, profissionais, empresa, cadastro complementar
  (substitui as máscaras locais) e formulário público (`f/[slug].astro`, corrige UX-073).
- **Aceite:** o servidor segue aceitando com ou sem pontuação (testes atuais); telefone fixo não vira celular.

### F5 — Tokens de cor, foco e alvos de toque · M
**Resolve:** UX-061, UX-062, UX-065.

- `global.css`: `--color-primary-text: #B0351C` (links, títulos laranja, "Esqueceu a senha?"); botão primário em
  `#C7432A` (≥ 4,5:1 com branco); `success` em `#3A6942` (já é `secondary-60`); botão `dark` em `#5C5C5C`;
  `.muted` e dicas → `#6B6B6B`; "Nenhum evento" → `#6B6B6B`; bordas de campo, checkbox e toggle desligado →
  `#8A8A8A`.
- `:focus-visible` global: anel de 2 px `--color-primary-50` com 2 px de afastamento em links, botões, campos,
  chips e no checkbox de `Checkbox.astro` (foco no rótulo quando o input está com `opacity: 0`). Remover os
  `outline: none` sem substituto.
- Mínimo de 24×24 px em interruptor, paginação, setas de ordem e `btn-sm`; 44 px em telas de toque (`@media (pointer: coarse)`).
- **Aceite:** tabela de contraste do relatório refeita com os novos valores, tudo ≥ AA; navegação só por Tab mostra
  o foco em todas as telas.

### F6 — Botão com estado de carregamento · P
**Resolve:** UX-021; base de UX-121 e UX-146.

- `data-carregando` em `Button.astro`: ao enviar o form (ou chamar `banketCarregando(btn, promise)`), desabilita,
  mostra spinner e o texto "Enviando…/Gerando…"; volta ao terminar (sucesso ou erro), não por tempo.
- `OrcamentoBuilder.tsx:113` (PDF liberado após 6 s fixos): trocar por `fetch` do PDF → blob → download, liberando
  na resposta.

### F7 — Glossário central · M (depende de D1)
**Resolve:** UX-020, base de UX-005 a UX-008.

- `lib/rotulos.ts` (puro): nomes de campos e módulos (`ROTULOS.tipo_evento = 'Tipo'`, `ROTULOS.categoria_evento =
  'Ocasião'`…). Formulário, card, resumo, filtros, CSV, formulário público e Configurações passam a ler daqui.
- Nomes só mudam na interface; tabelas e colunas do banco ficam como estão (sem migration).
- **Aceite:** `grep` de "Natureza", "Estilo" (fora de estilo gastronômico), "Sessão" (fora de login) e "Budget" em
  `src/` sem resultados na UI.

---

## Fase 1 — Correções que passam impressão errada ou perdem dados (≈ 1,5 semana)

| ID | O que fazer | Onde | Esforço | Aceite |
|---|---|---|---|---|
| UX-001 | Painel laranja com o texto aprovado (abaixo); remover os 4 pontos do carrossel e o CSS `.carousel-dots` | `layouts/AuthLayout.astro` (usado pelas 9 telas de `/auth`) | P | Nenhuma menção a "Yosp" ou "Auditoria" em `src/` |
| UX-002 / UX-040 | A mensagem "registrado no log do servidor" só aparece com `import.meta.env.DEV`; em produção, "Enviamos um link para {e-mail}. Não chegou? Reenviar". Configurar `RESEND_API_KEY` em produção (report-seguranca SEG-05) | `pages/auth/validacao.astro`, `.env` da VPS | P | Em produção a conta nova recebe o e-mail e confirma |
| UX-003 | Exemplos neutros: "Ex.: Salão Jardim", "Ex.: Maria Souza" | `configuracoes/empresa.astro:110,119` | P | — |
| UX-010 | Ligar a F1 nas 12 telas | ver F1 | (F1) | ver F1 |
| UX-011 | `FileUpload` valida tipo **e tamanho** (5 MB, `data-max-bytes`) antes de enviar; em erro no servidor, `templates/novo.astro` re-renderiza com os valores enviados (padrão de `eventos/novo.astro`) em vez de redirecionar; imagens: aviso "escolha a imagem de novo" no campo (o navegador não permite repor o arquivo) | `ui/FileUpload.astro`, `pages/templates/novo.astro`, `templates/TemplateForm.astro` | M | Imagem de 6 MB é recusada no navegador; erro no servidor mantém nome, textos e cores |
| UX-012 | Ligar a F2 | ver F2 | (F2) | — |
| UX-100 | Card inteiro clicável (abre o resumo) + menu "⋯" com Editar, Mover para…, Abrir orçamento; remover o botão laranja | `pages/eventos/index.astro:143-158` | M | Card sem botão "Editar"; menu acessível por teclado |
| UX-101 | Soma da coluna só com orçamentos; verba estimada aparece à parte ("+ R$ X em verba estimada", cinza) e no card como "Verba estimada" em itálico. Mesmo ajuste no script de arrastar (`index.astro:197`) e na coluna da lista (`Orçamento / Budget`) | `pages/eventos/index.astro:42-56,152,175,197` | P | Total da coluna = soma dos orçamentos |
| UX-103 | (D7) Ao soltar, o card vai para a posição pela data; o indicador de posição durante o arraste some | `pages/eventos/index.astro:204…` | P | Posição ao soltar = posição após recarregar |
| UX-112 | Sem orçamento: "Sem orçamento" + botão "Criar orçamento" | `eventos/[id]/index.astro:109` | P | — |
| UX-120 | (D2) `enviarProposta` congela a versão enviada e cria a próxima, na mesma transação, **só se o e-mail foi entregue**. O construtor recarrega na versão nova com o aviso. Histórico mostra "Enviada em … para …" na congelada | `server/envio.ts:102-120`, `server/orcamento.ts` (`criarNovaVersao` aceitar "a partir da enviada"), `pages/eventos/[id]/orcamento.astro` | M | Após enviar, a versão enviada não aceita edição e o PDF dela é o mesmo que foi anexado. E2e em `orcamento.spec.ts` |
| UX-121 | Botão "Enviar" com F6; passo de confirmação com resumo (destinatários, versão, valor total) antes do envio; o servidor recusa um segundo envio da mesma versão em menos de 60 s | `pages/eventos/[id]/orcamento.astro:123-…`, `server/envio.ts` | M | Duplo clique envia um e-mail só |
| UX-150 | "Remover logotipo" vira checkbox aplicado ao salvar (`removerName` do `FileUpload`, como no template); remover o `_action=remover_logo` | `configuracoes/empresa.astro:18,86` | P | Editar o nome e remover o logo no mesmo salvar mantém as duas coisas |
| UX-160 | Remover o select de papel da tabela; papel só no drawer; conceder "Proprietário" pede confirmação (F3) | `configuracoes/usuarios.astro:87` | P | Nenhuma mudança de papel sem confirmação |

**Texto do painel de autenticação (UX-001):**

- Título: *"Assuma o controle da sua operação: qualifique leads na entrada, acompanhe cada etapa e converta mais
  eventos."*
- Card (título conforme D3): *"Automatize a qualificação de contatos e gerencie com eficiência desde os longos ciclos
  corporativos até as vendas ágeis do setor social. Com uma gestão visual inteligente, o Banket otimiza o seu fluxo
  comercial para garantir a saúde financeira e a previsibilidade do seu negócio."*
- O título novo é um pouco mais longo que o atual: reduzir `.hero-text` para ~28 px em telas até 1280 px, para
  caber sem empurrar o card para fora da dobra.

---

## Fase 2 — Consistência (≈ 2,5 semanas)

### Textos e nomes

| ID | O que fazer | Onde | Esforço |
|---|---|---|---|
| UX-020 | Aplicar o glossário (F7) em formulário do evento, card, resumo, lateral (`EventoInfoLateral.astro`: mostrar a ocasião, nunca o título no lugar dela), filtros, CSV, Configurações, formulário público e respostas. Menu, cabeçalho e breadcrumb com o mesmo nome do módulo | `components/eventos/*`, `pages/eventos/**`, `configuracoes/*`, `lib/formularios/modelo.ts`, `components/Sidebar.astro`, `lib/nav.ts` | G |
| UX-005 | "Sessão" → "Seção" em toda a UI (menu, títulos, botões, formulário "Seções ativas"). A **rota** `/cardapio/sessoes` ganha um redirect 301 para `/cardapio/secoes` | `pages/cardapio/sessoes.astro` → `secoes.astro`, `lib/nav.ts`, `components/orcamento/Cardapios.tsx`, formulários | M |
| UX-004 | Título das abas "Página · Banket" em todas as telas (prop `title` do `Layout.astro` monta o sufixo) | `layouts/*.astro` e páginas | P |
| UX-006 | Caixa de frase em títulos, abas e colunas | busca por Title Case nas páginas | P |
| UX-007 | "Budget" → "Verba estimada", "Background" → "Cor de fundo", "Confeccionar orçamento" → "Criar orçamento", "Cachê / diária fixa" | páginas e ilhas | P |
| UX-008 | Botões de criar: "Novo evento", "Novo cliente", "Nova opção de cardápio", "Nova seção", "Novo template", "Novo bloco", "Novo formulário", "Convidar usuário" | páginas de listagem | P |
| UX-009 | Placeholders de autenticação: "seu@email.com.br"; sem placeholder em senha e nome | `pages/auth/*` | P |
| UX-018 | Rótulo obrigatório padrão: prop `required` no rótulo gera `*` com `aria-hidden` + `required` no campo; uma legenda "* obrigatório" no fim do form | `ui/Input.astro`, `.field label` em `global.css` | M |

### Formulários e salvamento

| ID | O que fazer | Onde | Esforço |
|---|---|---|---|
| UX-013 | Regra escrita (seção "Padrões de interface" no CLAUDE.md): **ilhas de edição contínua** (orçamento, blocos, textos) → autosave com indicador "Salvo às 14:32"; **formulários** → botão Salvar em barra fixa; **selects em tabela** → mudança via `fetch` + toast com Desfazer. Ajustar os casos fora da regra: status do evento (UX-117), período do dashboard (fica: é filtro, não dado) | CLAUDE.md, telas listadas no relatório | M |
| UX-014 | Alterações não salvas fora do drawer: script `data-form-sujo` (compara `FormData` com o inicial) com `beforeunload` e confirmação em links internos; ligar em empresa, template, editor de opção de cardápio, blocos de texto | `Layout.astro` + telas | M |
| UX-015 | Unificar campos: `.field` passa a ter raio 8 px e a borda da F5; `Input.astro` vira um invólucro do mesmo estilo; um único toggle (36×20) e um único checkbox; `.chip` fica só para seleção múltipla em chips | `global.css`, `ui/Input.astro`, `ui/Checkbox.astro` | M |
| UX-016 | Ligar a F4 em todas as telas | ver F4 | (F4) |
| UX-017 | `EventoForm`: validação no navegador (os mesmos campos obrigatórios do `eventoSchema`); erros do servidor devolvidos por campo (F1 `fieldErrors`) e exibidos sob o campo, com rolagem até o primeiro e um resumo clicável no topo | `components/eventos/EventoForm.astro`, `pages/eventos/novo.astro`, `editar.astro` | M |

### Feedback e componentes

| ID | O que fazer | Onde | Esforço |
|---|---|---|---|
| UX-019 | Modal F3 em todas as exclusões; no orçamento, remover seção/bebida/função/extra/linha sem modal, mas com "Desfazer" no toast (estado anterior guardado na ilha) | `components/orcamento/*.tsx` | M |
| UX-021 | F6 em: PDF de exemplo, salvar template, gerar PDF, enviar proposta | `templates/*`, `OrcamentoBuilder.tsx` | P |
| UX-022 | Componente `ui/EstadoVazio.astro` (ícone, frase, ação, link para o passo anterior). Itens do cardápio sem seções: "Crie primeiro uma seção" com link | listagens | M |
| UX-023 | Paginação com números (1 … 4 5 6 … 12), alvos de 32 px, sem zero à esquerda, seletor 20/50/100 (`pageParams` aceita `?por=`) | `ui/Pagination.astro`, `lib/pagination.ts` | M |
| UX-024 | Ordenação por coluna (`?ordem=campo&dir=asc`, colunas permitidas por tela no servidor) e linha inteira clicável em `Table.astro` | `ui/Table.astro`, `server/*` das listagens | G |
| UX-025 | Hierarquia de botões: **primário** (uma cor, a nova `primary` da F5) = ação principal; **secundário** (outline); **perigo** (vermelho só para excluir); verde deixa de ser botão de ação | `ui/Button.astro`, todas as telas (troca `variant="success"` → `primary`) | M |
| UX-026 | Barra de ações do orçamento em tamanho padrão: Enviar (primário), Baixar PDF (secundário), Nova versão (terciário/link) | `OrcamentoBuilder.tsx` | P |
| UX-027 | Ícone por bloco: `history`, `checklist`, `timeline`, `receipt_long`, `view_agenda`, `engineering`; tirar `account_circle` como padrão do `SectionCard`/acordeão | `ui/SectionCard.astro`, `ui/InfoCard.astro` e usos | P |
| UX-028 | "Exportar CSV" com ícone `download` | `pages/eventos/index.astro` | P |
| UX-029 | Remover o ícone "info" do `Topbar` (volta na fase 4 como ajuda contextual) | `components/Topbar.astro` | P |
| UX-124 | Abas do evento: "Orçamento" passa a ter sub-abas **Itens · Informações · Condições e textos · Pré-visualização**, com a versão sempre no cabeçalho; as rotas atuais `informacoes-complementares` e `condicoes-gerais` continuam, dentro do novo agrupamento | `layouts/EventoLayout.astro`, `pages/eventos/[id]/*` | M |
| UX-125 | Componente único "Adicionar ▾" com busca (combobox acessível) para cardápio, seção, item, bebida, função e extra; "Extra" abre linha vazia com foco na descrição | `components/orcamento/controles.tsx` + 5 ilhas | G |
| UX-140 | Editor de opção de cardápio com o mesmo cabeçalho e ordem de botões do Drawer (Excluir · Duplicar · Salvar · ✕) | `components/cardapio/OpcaoEditor.tsx` | M |
| UX-141 | (D5) Esconder hora extra do card e do form até o cálculo existir | `pages/staff/servicos.astro` | P |
| UX-144 | Ordem por arrastar (com setas acessíveis) salvando via `fetch` em seções, blocos e status | `sessoes`, `templates/blocos`, `configuracoes/status-orcamento` + endpoints `PATCH …/ordem` | M |
| UX-145 | Título "Editar item · {nome}"; filtro ativo/inativo; "Duplicar item" | `pages/cardapio/itens.astro`, `server/cardapio.ts` | M |
| UX-149 | Blocos: aviso de alteração não salva ao trocar de bloco (UX-014); checkbox decorativo vira selo "Padrão" | `pages/templates/blocos.astro` | P |
| UX-153 | Categorias de item com o mesmo padrão das de evento (nome como link, Excluir na linha) | `configuracoes/categorias.astro` | P |

---

## Fase 3 — Acessibilidade e celular (≈ 3,5 semanas)

| ID | O que fazer | Onde | Esforço |
|---|---|---|---|
| UX-030 (estrutura) | Pontos de quebra 1024 e 768 px. Abaixo de 1024: sidebar vira menu lateral recolhível (hambúrguer no `Topbar`, `inert` no conteúdo quando aberta); `padding` do conteúdo 16 px. Abaixo de 768: drawers em tela cheia, `form-grid` em uma coluna | `global.css`, `AppLayout.astro`, `Sidebar.astro`, `Topbar.astro`, `ui/Drawer.astro` | G |
| UX-030 (tabelas) | `Table.astro` com `data-label` por célula: abaixo de 768 px cada linha vira cartão (rótulo: valor), ações num menu "⋯" | `ui/Table.astro` + colunas das telas | M |
| UX-030 / UX-067 (Kanban) | Abaixo de 1024: abas por etapa (uma coluna por vez, com contagem); "Mover para…" no menu do card (UX-100) em todos os tamanhos, por teclado e toque; arrastar continua no desktop | `pages/eventos/index.astro` | G |
| UX-102 | Card compacto (cliente, data, pessoas, valor) com detalhes ao expandir; rolagem por coluna com cabeçalho fixo | `pages/eventos/index.astro` | M |
| UX-030 (telas pesadas) | (D8) Construtor de orçamento e editor de template: layout em uma coluna, barra de ações fixa embaixo; sem otimização além disso | `orcamento.css`, `editor.css` | M |
| UX-061 / 062 / 065 | Ligar a F5 e revisar tela a tela | todas | M |
| UX-063 | Drawer: foco preso, `inert` no restante da página, devolver o foco a quem abriu, Esc fecha (com a checagem de alterações da F1) | `ui/Drawer.astro` | M |
| UX-064 | Menu do usuário como `<button aria-haspopup="menu" aria-expanded>` + `role="menu"`, setas, Esc, fecha ao clicar fora | `components/Topbar.astro` | M |
| UX-066 | Etapa sempre com texto junto da cor (agenda mensal: nome curto ou ícone + legenda; lista: selo com texto) | `pages/agenda.astro`, `server/agenda.ts` | P |
| UX-023 | (fase 2) conferir alvos no celular | — | — |

**Aceite da fase:** navegação completa por teclado em login, Kanban, evento, orçamento e configurações; todas as telas
sem rolagem horizontal da página em 375 px; rodada de Lighthouse/axe sem violações "serious" nas 10 telas principais.
E2e novos com `viewport: 390×844` para Kanban (mover por "Mover para…") e drawer de cliente.

---

## Fase 4 — Fluxos e produtividade (contínua; ordem sugerida)

Itens agrupados por fluxo. Os marcados com **migration** exigem arquivo novo em `db/migrations/` (compatível com a
versão anterior: só colunas nullable ou com default).

### 4.1 Autenticação e onboarding

| ID | O que fazer | Esforço |
|---|---|---|
| UX-041 | Páginas `/termos` e `/privacidade` (públicas no middleware) e link no rótulo do aceite; no convite, checkbox antes do botão | M (texto jurídico à parte) |
| UX-042 | Cadastro complementar sem tipo pré-selecionado; CEP com busca de endereço (ViaCEP no navegador, com fallback manual); nome do buffet obrigatório também em PF | M |
| UX-043 | Remover a espera de 3 s em "Preparando ambiente": ir direto ao dashboard com os primeiros passos em destaque | P |
| UX-044 | Nome e e-mail de volta ao formulário via flash (cookie `banket_flash` ganha `valores`), não pela URL | P |
| UX-045 | No convite para conta existente: "Esqueci a senha" e "Entrar com link" | P |
| UX-046 | (D4) Texto do trial; "Esqueceu a senha?" fora do rótulo; "Manter conectado" (sessão de 7 dias só se marcado; senão cookie de sessão do navegador) | M |
| UX-047 | Um só componente de alerta nas telas de autenticação (`auth-alert`) | P |

### 4.2 Configuração inicial

| ID | O que fazer | Esforço |
|---|---|---|
| UX-050 | Submenu Cardápios na ordem Seções → Itens → Opções; o menu abre em Seções quando a empresa não tem seção; estado vazio de Itens (UX-022) | P |
| UX-051 | Primeiros passos para todos os papéis (passos do papel `usuario` sem Configurações) e "Ocultar" (preferência por usuário, **migration**: `tenant_usuarios.ocultar_primeiros_passos BOOLEAN DEFAULT false`) | M |
| UX-052 | Categorias de item em Cardápios › Categorias (rota nova, reaproveita o server); intervalo do Kanban como seletor no próprio Kanban (mantém a coluna do tenant) | M |
| UX-053 | Importar CSV de clientes e de itens do cardápio (modelo para baixar, prévia com erros por linha, grava só as válidas) | G |

### 4.3 Formulário público e administração de formulários

| ID | O que fazer | Esforço |
|---|---|---|
| UX-070 | Erro inline sob a pergunta, além do destaque; toast só como resumo | M |
| UX-071 | "Etapa 2 de 5 · Local" na barra; rascunho em `sessionStorage` (try/catch) restaurado ao recarregar | M |
| UX-072 | Tela de sucesso com resumo do pedido; e-mail de confirmação a quem preencheu (`server/emails.ts`, sem expor dados internos) | M |
| UX-073 | (F4) máscara de telefone 10/11 dígitos | (F4) |
| UX-074 | Gerar miniatura do logo no upload da empresa (PNG ≤ 400 KB via canvas no navegador, gravada ao lado do original) e usar no formulário | M |
| UX-075 | "Novo formulário" abre modal pedindo o nome; só grava ao confirmar | P |
| UX-076 | Pré-visualização ao lado do editor (renderiza o mesmo componente da página pública com a config em edição) | G |
| UX-077 | "Compartilhar": URL completa, snippet de `<iframe>`, QR code (gerado no navegador) e link `wa.me` com a URL | M |
| UX-078 | Respostas: "Corporativo/Social" no lugar de B2B/B2C; drawer com a resposta completa; filtro por período; exportar CSV | M |
| UX-079 | Card mostra a URL completa | P |

### 4.4 Funil, evento e checklist

| ID | O que fazer | Esforço |
|---|---|---|
| UX-104 | Modal curto ao mover para `recusado` (motivo em lista + texto) e `aprovado` (data de fechamento); "Desfazer" no toast. **Migration**: `eventos.motivo_perda TEXT`, `eventos.fechado_em DATE`; motivo entra na timeline | M |
| UX-105 | Filtros em barra horizontal com chips removíveis; filtro de etapa também no Kanban; busca com botão e debounce | M |
| UX-106 | Card: título = ocasião + data; subtítulo = cliente | P |
| UX-107 | Selo "há 9 dias nesta etapa" (data da última mudança de status vinda da timeline) | M |
| UX-110 | Checklist: campo de prazo (coluna já existe), atrasados em destaque, edição inline do texto | M |
| UX-111 | Resumo reorganizado em Contato · Evento · Logística · Comercial; cliente aparece uma vez | M |
| UX-113 | Cabeçalho "Funil de vendas / {título do evento}" com link de volta | P |
| UX-114 | Formulário do evento em blocos recolhíveis com os essenciais abertos; duração calculada de início/término (editável); verba total ↔ por pessoa calculadas pelo nº de convidados | M |
| UX-115 | Filtro de ocasião por tipo recriando as `<option>` via JS (sem `option.hidden`), funciona no Safari | P |
| UX-116 | Links `mailto:` e `https://wa.me/55…` para e-mail e WhatsApp do responsável e do cliente | P |
| UX-117 | Status na faixa superior via `fetch` (`PATCH /api/eventos/:id/status`, já existe) + toast com Desfazer | P |

### 4.5 Orçamento e proposta

| ID | O que fazer | Esforço |
|---|---|---|
| UX-122 | Sub-aba "Pré-visualização" (UX-124) com `<iframe>` de uma rota autenticada que renderiza o mesmo `Proposta.astro` da impressão | M |
| UX-123 | Destinatários em chips com validação de e-mail (máx. 5); pré-visualizar o e-mail com as variáveis substituídas e o nome do anexo | M |
| UX-126 | Autosave também no `input` (debounce 800 ms) e envio forçado no `pagehide` com `fetch(…, { keepalive: true })`; o mesmo em BlocosEditor e TextosProposta | M |
| UX-127 | Tooltip em "Pagantes": "convidados − isentas − meia × 0,5" | P |
| UX-128 | Bloquear a roda do mouse em `type=number` sem foco (handler global em `controles.tsx`) | P |
| UX-129 | Descrição do item visível ao expandir o chip (toque e teclado) | P |
| UX-130 | Reordenar blocos e linhas (setas + arrastar); foco no campo da linha nova, que nasce vazia | M |

### 4.6 Acompanhamento

| ID | O que fazer | Esforço |
|---|---|---|
| UX-090 | "Nova anotação" na linha do tempo: tipo (ligação, visita, degustação, WhatsApp, outro), texto e data de retorno opcional; retornos vencidos no dashboard. **Migration**: acrescentar `anotacao` ao CHECK de `evento_timeline.tipo` + `retorno_em DATE` nullable | M |
| UX-091 | Cada bloco do dashboard rotulado com o próprio recorte ("Próximos 30 dias", "Sem retorno há 7+ dias"); texto "Valores pelo orçamento mais recente de cada evento" | P |
| UX-092 | KPIs como link para a lista filtrada; variação % vs. período anterior | M |
| UX-093 | Clique no dia da agenda → novo evento com a data; recusados ocultos por padrão; legenda das etapas | M |
| UX-094 | Visão "Lista" na agenda e assinatura iCal (URL com token por usuário; FUN-09 do report.md) | G |

### 4.7 Cadastros e configurações

| ID | O que fazer | Esforço |
|---|---|---|
| UX-142 | Detalhe do cliente com "Editar" e resumo (nº de eventos, valor aprovado, último contato) | M |
| UX-143 | Profissionais: coluna "Último evento" (quando houver escala por evento) e link de WhatsApp | P |
| UX-146 | "PDF de exemplo" salva antes de gerar (ou avisa que há alterações não salvas); disponível na criação após o primeiro salvar automático | M |
| UX-147 | Pré-visualização do template com a proposta de exemplo real em miniatura (mesma renderização do PDF, via `<iframe>` escalado) | G |
| UX-148 | Barra de ações fixa no editor de template | P |
| UX-151 | Variáveis do modelo de e-mail como chips que inserem no cursor; pré-visualização com dados de exemplo | M |
| UX-152 | (D6) Local padrão como sugestão no evento | P |
| UX-154 | Página "Minha conta": nome, telefone, troca de senha (exige a atual), empresas a que pertence | M |

### 4.8 Oportunidades de produto (seção 4 do relatório)

Ficam como backlog, cada uma com especificação própria antes de começar.

| # | Oportunidade | Depende de | Esforço |
|---|---|---|---|
| 1 | Busca global (Ctrl+K) em clientes, eventos e itens | UX-020 (nomes estáveis) | G |
| 2 | Central de notificações (pedido novo, proposta sem retorno, prazo de checklist, evento na semana) | UX-090, UX-110 | G |
| 3 | Ações rápidas no dashboard | — | P |
| 4 | Começar orçamento a partir de um anterior semelhante | UX-125 | G |
| 5 | Página pública da proposta com Aprovar/Recusar (FUN-05) | UX-120, UX-122 | G |
| 6 | Ajuda contextual no ícone "info" do topo | UX-029 | M |
| 7 | Modo compacto e tema escuro | F5 (tokens) | M / G |

---

## Sequência e dependências

```
Fase 0: F2 Toast ─┬─ F3 Modal ─┬─ F1 Drawer assíncrono
                  │            └─ F6 Carregando
                  F4 Máscaras · F5 Tokens · F7 Glossário (após D1)
Fase 1: depende de F1, F2, F3, F6 (UX-010/012/120/121/160)
Fase 2: depende de F7 (UX-020/005), F4 (UX-016), F5 (UX-025)
Fase 3: depende de UX-100 (menu do card → "Mover para…")
Fase 4: itens independentes entre si, na ordem das tabelas
```

| Fase | Duração estimada | Deploys |
|---|---|---|
| 0 — Fundações | 1,5 semana | 1 (F2+F3+F6 podem ir antes, sozinhos) |
| 1 — Correções críticas | 1,5 semana | 1–2 |
| 2 — Consistência | 2,5 semanas | 2 (textos/nomes · componentes) |
| 3 — Acessibilidade e celular | 3,5 semanas | 2 (estrutura · Kanban e tabelas) |
| 4 — Fluxos | contínua, ~6 semanas para 4.1–4.7 | um por grupo |

Os itens P da fase 1 que não dependem das fundações (UX-001, 002, 003, 101, 103, 112, 150) podem ir num primeiro
deploy imediato, antes da fase 0.

## Testes e ambiente

- **Unitários** para toda função pura nova: máscaras, `fieldErrors`, rótulos, cálculo de duração/verba.
- **E2e** novos por fase (listados nos critérios de aceite). Os e2e criam e apagam dados e dependem dos seeds, por
  isso **não devem rodar contra o banco de produção**. Para rodar na VPS, subir um ambiente de dev isolado
  (`docker-compose.yml` + `docker-compose.dev.yml` com nome de projeto e porta próprios, banco separado) e instalar o
  navegador do Playwright (`npx playwright install chromium`). É um passo a fazer antes da fase 0.
- **Revisão visual** por fase com `node scripts/screenshots.mjs` nas larguras 1440, 1024 e 390.
- **Teste com usuários** (recomendação do relatório): 3–5 pessoas de buffet ao fim da fase 2, antes de priorizar a
  fase 4.
- **Documentação:** ao fim de cada fase, atualizar CLAUDE.md (e copiar para AGENTS.md) com os componentes novos
  (Drawer assíncrono, Toast, Confirmar, máscaras, rótulos) e a regra de salvamento da UX-013.

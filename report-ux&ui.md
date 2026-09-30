# Banket — Relatório de UX e UI

**Data:** 28/09/2026 · **Código revisado:** `main` @ `f485bad` · Complementa [report.md](report.md) e [report-seguranca.md](report-seguranca.md)

## Método e limites

- **Revisão tela a tela do código da interface:** todas as páginas de `src/pages`, layouts, componentes de `components/ui`,
  as ilhas Preact (orçamento, opções de cardápio, editor de formulário) e os scripts de cada tela. Cada fluxo foi
  percorrido pelo caminho que o usuário faz: onde clica, o que é enviado, o que acontece em caso de sucesso e de erro.
- **Conferência em produção** das telas públicas (cadastro, login, validação), sem login.
- **Contraste de cores** calculado pela fórmula WCAG 2.1 sobre os tokens de `global.css`.
- **Limite:** não naveguei logado nem testei em aparelhos reais. Quando um item depende de comportamento em tempo de
  execução, está marcado como **(verificar em teste)**. Recomendo uma rodada de teste com 3–5 usuários reais de buffet
  para validar prioridades.

**Legenda de severidade:**
- **Alta:** impede a tarefa, perde dados ou passa informação errada ao cliente.
- **Média:** atrapalha, confunde ou gera retrabalho.
- **Baixa:** polimento.

**Tipo:**
- **Erro:** comportamento incorreto.
- **Inconsistência:** o mesmo conceito tratado de formas diferentes.
- **Melhoria:** oportunidade.

> **Correção ao report.md:** o item UX-17 dizia que não havia botão de mostrar/ocultar senha. O botão existe
> (`Input.astro`). O item foi corrigido lá.

---

## 1. Resumo executivo — os 15 pontos que mais pesam

| # | ID | Sev. | Problema |
|---|---|---|---|
| 1 | UX-001 | Alta | A tela de cadastro (e outras de autenticação) mostra **texto de outro produto**: "Auditoria Remota — A Yosp fornece relatórios visuais…". Confirmado em produção |
| 2 | UX-002 | Alta | A tela "Confirme seu e-mail" exibe ao cliente final "o link de confirmação foi registrado no log do servidor" (confirmado em produção) e o e-mail não chega |
| 3 | UX-010 | Alta | **Todo formulário em drawer perde o que foi digitado quando o servidor recusa** (CPF inválido, nome duplicado…): a página recarrega e o painel fecha |
| 4 | UX-011 | Alta | **Criar template com erro apaga tudo**, inclusive as imagens escolhidas |
| 5 | UX-020 | Alta | Nomes trocados entre telas: "Formato", "Estilo", "Natureza", "Categoria" e "Tipo" designam coisas diferentes em cada lugar (o card do Kanban chama o *formato de serviço* de "Estilo"; o resumo do evento chama a *categoria* de "Formato") |
| 6 | UX-030 | Alta | O app não se adapta ao celular: sidebar fixa de 265 px, Kanban só com mouse, drawers de 900 px |
| 7 | UX-120 | Alta | **Proposta enviada continua editável**: depois de "Enviar ao cliente" a versão não é congelada, então o que o cliente recebeu pode divergir do sistema sem ninguém perceber |
| 8 | UX-121 | Alta | Enviar a proposta não mostra progresso (gera o PDF e manda o e-mail em segundos); dá para clicar duas vezes e mandar em dobro |
| 9 | UX-100 | Média | O botão do card do Kanban diz **"Editar"**, mas abre o resumo do evento |
| 10 | UX-101 | Média | A soma das colunas do Kanban mistura valor de orçamento com "Budget" (verba estimada), então o total não significa nada |
| 11 | UX-012 | Média | Mensagens de erro somem em 4,5 s, sem botão de fechar, e aparecem **sobre o botão "Salvar" dos drawers** |
| 12 | UX-160 | Média | Trocar o papel de um usuário na tabela salva na hora, sem confirmação: um clique errado promove alguém a **Proprietário** |
| 13 | UX-061 | Média | Contraste insuficiente em botões primários, links laranja, textos auxiliares e bordas de campos (WCAG AA) |
| 14 | UX-090 | Média | A linha do tempo do evento não permite registrar anotações (ligação, visita, degustação), o básico de um CRM |
| 15 | UX-150 | Média | Remover o logotipo em Configurações › Empresa **descarta as outras alterações** feitas no mesmo formulário |

---

## 2. Problemas transversais (padrões de interface)

### 2.1 Conteúdo e textos

| ID | Sev. | Tipo | Onde | Problema | Sugestão |
|---|---|---|---|---|---|
| UX-001 | Alta | Erro | [AuthLayout.astro](src/layouts/AuthLayout.astro) (cadastro, validação, cadastro complementar, convite, direcionamento) | Painel lateral com texto de outro produto: "Em alguns instantes você irá transformar a sua gestão em um processo padronizado, auditável e seguro" + card "Auditoria Remota — **A Yosp** fornece relatórios visuais que atestam a qualidade do patrimônio…". Há também 4 "bolinhas" de carrossel que não fazem nada | Texto de valor do Banket (ex.: "Da captação à proposta em PDF em minutos"), com 2–3 benefícios reais ou depoimento de buffet; remover os pontos do carrossel ou implementá-lo |
| UX-002 | Alta | Erro | [validacao.astro](src/pages/auth/validacao.astro) | Com o e-mail desligado, o cliente vê "Ambiente sem envio de e-mail configurado: o link de confirmação foi registrado no log do servidor". Mensagem técnica e sem saída para o usuário | Nunca mostrar em produção; configurar o e-mail (ver report-seguranca SEG-05) |
| UX-003 | Média | Erro | [empresa.astro](src/pages/configuracoes/empresa.astro) | Exemplos com nomes reais do projeto de origem: "Ex.: Casa Club Gourmet", "Ex.: Newton Oliveira" | Exemplos neutros ("Ex.: Salão Jardim", "Ex.: Maria Souza") |
| UX-004 | Média | Inconsistência | Títulos das abas do navegador | Três padrões: "Login - Banket", "Dashboard \| Banket CRM", "Direcionando... - Banket CRM". A marca aparece como "Banket", "Banket CRM" e "Gestor de Relacionamento Banket" | Um padrão só: "Página · Banket" |
| UX-005 | Média | Inconsistência | Todo o sistema | **"Sessão" do cardápio** (menu, tabela, orçamento, formulário: "Sessões ativas") quando o termo certo é **"Seção"**. "Sessão" também é o termo técnico de login, o que confunde | Trocar para "Seção" em toda a UI |
| UX-006 | Baixa | Inconsistência | Títulos e rótulos | Mistura de Title Case e caixa de frase: "Itens do Cardápio", "Tipos de Evento", "Informações Complementares", "E-mail Validado", "Nome Categoria", "Itens Vinculados" × "Status de orçamento", "Linha do tempo", "Formatos de serviço" | Caixa de frase em todos os títulos, abas e colunas |
| UX-007 | Baixa | Inconsistência | Rótulos | Estrangeirismos e jargão: "Budget", "Background", "Confeccionar orçamento", "Cachê / Diária Fixo" (concordância) | "Verba estimada", "Cor de fundo", "Criar orçamento", "Cachê / diária fixa" |
| UX-008 | Baixa | Inconsistência | Botões de criar | "Criar novo evento", "Adicionar cliente", "Criar cardápio", "Adicionar sessão", "Criar novo template", "Criar novo bloco", "Criar formulário", "Adicionar usuário" (que abre "Convidar usuário") | Padrão "Novo(a) X" em todos, e "Convidar usuário" no botão de usuários |
| UX-009 | Baixa | Erro | Placeholders de autenticação | "XXXXXXXX", "xxxx@xxxx.com.br", "Nome Sobrenome" parecem máscara quebrada | Placeholder descritivo ("seu@email.com.br") ou nenhum |

### 2.2 Formulários, salvamento e perda de dados

| ID | Sev. | Tipo | Onde | Problema | Sugestão |
|---|---|---|---|---|---|
| UX-010 | Alta | Erro | Todas as telas com [Drawer](src/components/ui/Drawer.astro) + `handleFormPost` (clientes, itens, seções, staff, profissionais, status, categorias, formatos, locação, tipos, usuários, convite) | Com erro de validação do servidor (CPF inválido, e-mail duplicado, nome repetido), a página recarrega e mostra um toast, mas **o drawer fecha e tudo o que foi digitado some**. O usuário precisa lembrar e redigitar | Enviar o drawer via `fetch` (JSON) e mostrar o erro **no campo**, mantendo o painel aberto; alternativa mínima: na volta, reabrir o drawer com os valores enviados (guardar no flash) |
| UX-011 | Alta | Erro | [templates/novo.astro](src/pages/templates/novo.astro), [TemplateForm.astro](src/components/templates/TemplateForm.astro) | Em "Novo template", qualquer erro (imagem acima de 5 MB, formato inválido) redireciona para um formulário **em branco**: perde nome, textos, cores e as imagens escolhidas | Validar tamanho e tipo no navegador antes de enviar ([FileUpload](src/components/ui/FileUpload.astro) só confere o tipo); manter os valores em caso de erro, como já faz [eventos/novo](src/pages/eventos/novo.astro) |
| UX-013 | Média | Inconsistência | Sistema | Cinco jeitos diferentes de salvar: autosave (orçamento), salvar ao sair do campo (blocos e textos da proposta), botão Salvar no topo (drawers, empresa, template), botão no rodapé (editor de formulário), salvar ao mudar o select (papel, categoria, especialidade, status, template da proposta, período do dashboard) | Definir a regra: listas com edição rápida → autosave com indicador; formulários → botão fixo (sticky) visível no topo e no fim; selects em tabela → confirmação ou "desfazer" no toast |
| UX-014 | Média | Erro | Drawer, editor de opção de cardápio, blocos de texto, template, empresa | Sem aviso de alterações não salvas: Esc, clique fora do drawer ou trocar de bloco na lista **descarta a edição** sem perguntar (o orçamento e o editor de formulário avisam) | Marcar o formulário como "sujo" e confirmar antes de fechar ou navegar |
| UX-015 | Média | Inconsistência | Campos | Dois sistemas de formulário: `Input.astro` (raio 8 px, borda #E2E2E2, rótulo em CAIXA ALTA passada à mão) nas telas de login, e `.field` (raio 4 px, borda #AAA) no app. Dois interruptores (36×20 e 24×12 px) e dois checkboxes (`Checkbox.astro` e `.chip`) | Unificar os componentes de campo, checkbox e toggle |
| UX-016 | Média | Melhoria | Eventos, clientes, staff, empresa | Máscaras só existem no cadastro complementar e no formulário público. No app, CPF/CNPJ, telefone, WhatsApp e valores em R$ são texto livre | Reaproveitar as máscaras do onboarding em todo o sistema |
| UX-017 | Média | Erro | [EventoForm.astro](src/components/eventos/EventoForm.astro) (`novalidate`) | O erro aparece como **uma frase no topo** (só o primeiro problema), sem destacar o campo. Quem clicou em "Criar evento" no rodapé de um formulário longo não sabe o que corrigir | Validar no cliente e mostrar os erros por campo, rolando até o primeiro |
| UX-018 | Baixa | Melhoria | Campos obrigatórios | Asterisco inconsistente: "Cliente\*", "Nome\*" etc. no texto do rótulo, e "\*Dados obrigatórios" só no login | Componente de rótulo com indicador padrão e legenda única |

### 2.3 Feedback, confirmações e estados

| ID | Sev. | Tipo | Onde | Problema | Sugestão |
|---|---|---|---|---|---|
| UX-012 | Média | Erro | [Toast.astro](src/components/ui/Toast.astro) | Todos os toasts somem em 4,5 s, inclusive **erros**; não há botão de fechar; erros usam `role="status"` (leitor de tela não interrompe). Posição `top: 24px; right: 24px` **cobre os botões Excluir/Salvar do cabeçalho do drawer** | Erros persistentes com botão ✕ e `role="alert"`; mover para baixo à direita ou deslocar quando um drawer estiver aberto |
| UX-019 | Média | Inconsistência | Exclusões | Confirmação com `window.confirm` genérico ("Tem certeza que deseja excluir este registro?"). Algumas exclusões não pedem confirmação: remover seção, bebida, função de staff ou extra no orçamento, remover linha de bloco. Excluir **seção do cardápio apaga todos os itens dela** com um confirm simples | Modal próprio com o impacto ("12 itens serão excluídos"); "Desfazer" no toast para remoções dentro do orçamento |
| UX-021 | Média | Melhoria | Ações demoradas | Sem estado de carregamento em: enviar proposta, PDF de exemplo, salvar template com imagens, gerar PDF (o botão se libera sozinho após 6 s, esteja pronto ou não) | Botão com spinner e desabilitado até a resposta |
| UX-022 | Média | Melhoria | Listas vazias | Estados vazios só com texto ("Nenhum item encontrado."). Em conta nova, a lista de itens não diz que é preciso criar uma seção antes | Estado vazio com explicação + botão de ação (e link para o passo anterior quando houver dependência) |
| UX-023 | Baixa | Erro | [Pagination.astro](src/components/ui/Pagination.astro) | Botões de página de **18×18 px** (mínimo recomendado: 24×24; ideal 44 no toque); só anterior/próxima; "Página 01 de 03" com zero à esquerda | Alvos de 32 px+, números de página, seletor de itens por página |
| UX-024 | Baixa | Melhoria | Tabelas | Sem ordenação por coluna; só o nome (às vezes) é link; nada de ações em lote | Cabeçalho clicável para ordenar; linha inteira clicável |

### 2.4 Nomenclatura do domínio (causa-raiz de confusão)

**UX-020 — Alta — Inconsistência.** O mesmo dado aparece com nomes diferentes, e nomes iguais designam dados diferentes:

| Dado no banco | Formulário do evento | Card do Kanban | Resumo / lateral do evento | Outros |
|---|---|---|---|---|
| `tipos_evento` (Social, Corporativo) | "Natureza (tipo)" | tag | "Natureza do evento" (dentro de **Responsável**) | Configurações: "Tipos de Evento" |
| `categorias_evento` (Casamento…) | "Formato do evento (categoria)" | tag | **"Formato"** (lateral) | Configurações: "Categorias" |
| `formatos_servico` (Buffet, Coquetel…) | "Formato de serviço" | **"Estilo"** | "Formato de serviço" | Item do cardápio: "Formato de serviço recomendado" |
| `estilo_principal/secundario` | "Estilo principal/secundário" | — | "Estilo gastronômico" | — |
| `status_orcamento` | "Status" | coluna | "Status do evento" | Configurações: "Status de orçamento" (mas é a etapa do **evento** no funil) |

Além disso, a lateral do evento mostra `categoria_nome ?? titulo` sob o rótulo "Formato"
([EventoInfoLateral.astro](src/components/eventos/EventoInfoLateral.astro)); sem categoria, aparece o título do evento
no lugar do formato. O menu diz **"Quadro de vendas"**, mas o cabeçalho da página e as telas de evento dizem
**"Eventos"**.

**Sugestão:** glossário único. Por exemplo: *Tipo* (Social/Corporativo), *Ocasião* (Casamento…), *Formato de serviço*
(Buffet…), *Etapa do funil* (status). Aplicar em formulário, card, resumo, filtros e configurações; um só nome para o
módulo ("Funil de vendas" ou "Eventos").

### 2.5 Hierarquia visual e componentes

| ID | Sev. | Tipo | Onde | Problema | Sugestão |
|---|---|---|---|---|---|
| UX-025 | Média | Inconsistência | Botões | A ação principal ora é **verde** (`success`: Salvar, Criar novo evento, Criar evento, Abrir orçamento), ora **laranja** (`primary`: Adicionar cliente, Criar cardápio, Adicionar no orçamento, Criar nova versão). No orçamento convivem 4 cores (outline, success, primary, dark) para ações do mesmo nível | Uma cor para a ação principal, uma para a secundária e uma para perigo; verde só para confirmação ou sucesso |
| UX-026 | Média | Erro | Construtor de orçamento | As ações mais importantes da tela ("Enviar ao cliente", "Salvar e baixar PDF", "Criar nova versão") usam `btn-sm` (28 px de altura, fonte 12 px, peso 400) | Tamanho padrão e hierarquia: Enviar (principal), PDF (secundário), Nova versão (terciário) |
| UX-027 | Baixa | Erro | Ícones | `account_circle` usado como ícone genérico de títulos que nada têm a ver com pessoa: "Histórico de versões", "Checklist operacional", "Linha do tempo", "Resumo do orçamento", "Blocos", "Informações operacionais" e padrão do acordeão | Ícone específico por bloco (history, checklist, timeline, receipt…) |
| UX-028 | Baixa | Erro | "Exportar" no Kanban | Ícone `upload` para uma ação de **download** | `download` + texto "Exportar CSV" |
| UX-029 | Baixa | Erro | [Topbar.astro](src/components/Topbar.astro) | Ícone "info" ao lado de todo título de página, sem função | Remover ou abrir ajuda contextual da tela |

### 2.6 Responsividade

**UX-030 — Alta — Melhoria.** O app autenticado não tem regras para telas pequenas: `global.css`, `AppLayout` e
`Sidebar` não têm `@media`. Só dashboard, agenda, template e as telas públicas se adaptam.
- A sidebar ocupa 265 px fixos e não recolhe. O conteúdo tem `padding: 32px 45px`.
- Os drawers têm 900 px (`max-width: 100%` evita estourar, mas o conteúdo de 2 colunas fica espremido).
- O Kanban usa HTML5 drag-and-drop, que **não funciona em toque**.
- Tabelas com 5–7 colunas dependem de rolagem horizontal.

**Sugestão:** menu recolhível (hambúrguer) abaixo de 1024 px; drawers em tela cheia no celular; tabelas viram cartões;
Kanban com uma coluna por vez (abas por etapa) e "Mover para…" no card. É prioridade para buffet, cujo comercial atende
por WhatsApp no celular.

### 2.7 Acessibilidade (WCAG 2.1 AA)

**UX-061 — Média — Contraste** (calculado sobre os tokens):

| Combinação | Contraste | Mínimo | Situação |
|---|---|---|---|
| Texto branco no botão primário `#E35336` | 3,78:1 | 4,5:1 (texto 14 px) | Reprova |
| Texto branco no botão `dark` `#888` | 3,54:1 | 4,5:1 | Reprova |
| Texto branco no botão `success` `#4E8658` | 4,31:1 | 4,5:1 | Reprova por pouco |
| Link/título laranja `#E35336` sobre branco | 3,78:1 | 4,5:1 | Reprova (`.link`, `.bloco-titulo`, "Esqueceu a senha?") |
| Texto auxiliar `#888` sobre `#F7F7F7` (`.muted`, dicas de campo) | 3,31:1 | 4,5:1 | Reprova |
| "Nenhum evento" do Kanban `#AAA` sobre `#F7F7F7` | 2,17:1 | 4,5:1 | Reprova |
| Borda de campo `#AAA` sobre branco | 2,32:1 | 3:1 (não-texto) | Reprova |
| Borda do `Input`/checkbox `#E2E2E2` sobre branco | 1,30:1 | 3:1 | Reprova (o campo praticamente não aparece) |
| Toggle desligado `#CCC` sobre branco | 1,61:1 | 3:1 | Reprova |
| Texto de tabela `#666` sobre branco | 5,74:1 | 4,5:1 | Aprova |

**Sugestão:** criar `--color-primary-text` (ex.: `#B0351C`, já existente como `primary-50`) para texto e links; botão
primário com `#C7432A` ou texto em negrito ≥ 18,66 px; `.muted` → `#6B6B6B`; bordas → `#8A8A8A`.

| ID | Sev. | Problema | Sugestão |
|---|---|---|---|
| UX-062 | Média | Foco quase invisível: `outline: none` nos campos, substituído por sombra com 10–12 % de opacidade; o checkbox de `Checkbox.astro` (input com `opacity: 0`) **não mostra foco nenhum**; links e botões de texto não têm `:focus-visible` | Anel de foco de 2 px com contraste ≥ 3:1 em todos os interativos |
| UX-063 | Média | Drawer com `aria-modal`, mas sem prender o foco, sem devolver o foco a quem abriu e sem bloquear a página de fundo (Tab passeia por trás) | Foco preso, `inert` no fundo, devolver o foco ao fechar |
| UX-064 | Média | Menu do usuário (troca de empresa, Sair) abre em uma `<div>` clicável: inacessível por teclado, sem `aria-expanded`, sem Esc | `<button aria-haspopup="menu">` + navegação por setas |
| UX-065 | Baixa | Alvos pequenos: interruptor de 24×12 px, paginação 18 px, `btn-sm` de 28 px, botões de ordem (setas) no status | Mínimo de 24×24 px (ideal 44 no toque) |
| UX-066 | Baixa | Cores de status do Kanban e da agenda são a única pista de etapa (bolinha colorida) em vários lugares | Sempre acompanhar com texto (a agenda mensal só mostra a cor) |
| UX-067 | Baixa | Kanban arrastável sem alternativa por teclado | "Mover para…" no card (resolve também o toque, UX-030) |

---

## 3. Fluxos de uso

### 3.1 Cadastro, onboarding e acesso

| ID | Sev. | Tipo | Problema | Sugestão |
|---|---|---|---|---|
| UX-040 | Alta | Erro | Veja UX-001/UX-002. Além disso, com o e-mail desligado, o fluxo termina num beco: a conta não pode ser confirmada | Configurar o e-mail; alternativa temporária: código de 6 dígitos na tela |
| UX-041 | Média | Erro | "Termos e Condições de Uso" é obrigatório, mas **não é link** e não há página de termos. No convite, o checkbox aparece **depois** do botão "Finalizar e acessar" | Link para os termos (e política de privacidade); checkbox antes do botão |
| UX-042 | Média | Melhoria | Cadastro complementar: tipo **PJ** vem pré-selecionado sem escolha do usuário; endereço em campo único, sem CEP (sem autopreenchimento); o nome do buffet é "opcional" e, em PF, a empresa passa a se chamar com o nome da pessoa | Nenhum tipo pré-selecionado (ou PF); CEP com busca de endereço; pedir o nome do buffet sempre (aparece na proposta) |
| UX-043 | Média | Melhoria | Após criar a empresa, a tela "Preparando ambiente" segura o usuário **3 s** com uma barra de progresso falsa (a empresa já foi criada) | Ir direto para o dashboard com a lista de primeiros passos em destaque |
| UX-044 | Baixa | Erro | Após erro no cadastro, nome e e-mail voltam pela URL (`?nome=…&email=…`); após erro no login, o e-mail também vai na URL. Dados pessoais ficam no histórico do navegador | Guardar no flash (cookie) em vez da query string |
| UX-045 | Baixa | Melhoria | Convite para quem já tem conta pede a senha, mas não oferece "Esqueci a senha" nem "Entrar com link" | Incluir os dois atalhos |
| UX-046 | Baixa | Melhoria | Login: sem "manter conectado"; "Esqueceu a senha?" fica sobreposto ao rótulo SENHA; a chamada "Teste grátis por 30 dias" promete um trial que não existe no produto (ver report.md FUN-02) | Ajustar o texto até o trial existir |
| UX-047 | Baixa | Inconsistência | Erros no convite aparecem numa caixa própria (`auth-error`); nas outras telas de autenticação, no alerta de flash | Um só componente de alerta |

### 3.2 Configuração inicial da empresa

| ID | Sev. | Tipo | Problema | Sugestão |
|---|---|---|---|---|
| UX-050 | Média | Erro | O menu "Cardápios" abre em **Itens**, mas item exige seção. Em conta nova, o usuário abre o drawer, encontra o select "Sessão\*" vazio e trava. O submenu segue a mesma ordem invertida (Itens → Seções → Opções) | Ordem Seções → Itens → Opções; estado vazio de Itens com "Crie primeiro uma seção" |
| UX-051 | Média | Melhoria | "Primeiros passos" só aparece para owner/admin e não pode ser dispensado; o usuário comum de conta nova vê um dashboard zerado sem orientação | Mostrar a todos (com passos adequados ao papel) e permitir ocultar |
| UX-052 | Média | Inconsistência | Categorias **de item do cardápio** ficam em Configurações › Categorias (aba), longe do cardápio. O intervalo do Kanban fica escondido em "Status de orçamento" | Categorias de item dentro de Cardápios; intervalo do Kanban no próprio Kanban (preferência do usuário) ou numa seção "Funil" |
| UX-053 | Baixa | Melhoria | Nenhuma importação (clientes, catálogo) para quem já tem planilha | Importar CSV com modelo para baixar |

### 3.3 Captação pelo formulário público (visão do cliente do buffet)

| ID | Sev. | Tipo | Problema | Sugestão |
|---|---|---|---|---|
| UX-070 | Média | Melhoria | Erros de validação só aparecem em toast (que some em 4,5 s); não há mensagem junto à pergunta | Mensagem inline sob a pergunta, além do destaque |
| UX-071 | Média | Melhoria | A barra de progresso não diz em que etapa se está ("Etapa 2 de 5"); recarregar a página **perde todas as respostas** | Texto da etapa; rascunho em `sessionStorage` |
| UX-072 | Média | Melhoria | A tela de sucesso não resume o pedido e não há e-mail de confirmação para quem preencheu | Resumo do pedido + e-mail de confirmação (ver report.md FUN-03) |
| UX-073 | Baixa | Erro | Máscara de telefone formata números fixos (10 dígitos) como celular: "(11) 3333-4444" vira "(11) 33334-444" | Máscara que diferencia 10 e 11 dígitos, como a do onboarding |
| UX-074 | Baixa | Erro | O logotipo da empresa **some sem aviso** se o arquivo tiver mais de 400 KB | Gerar uma miniatura do logo no upload |

### 3.4 Formulários (administração)

| ID | Sev. | Tipo | Problema | Sugestão |
|---|---|---|---|---|
| UX-075 | Média | Erro | "Criar formulário" grava na hora um formulário chamado "Novo formulário". Quem desiste deixa lixo na lista | Pedir nome primeiro (modal) ou só gravar no primeiro Salvar |
| UX-076 | Média | Melhoria | Não há pré-visualização no editor: para ver o resultado, é preciso salvar, ativar e abrir o link público | Painel de pré-visualização ao lado do editor |
| UX-077 | Média | Melhoria | O formulário foi feito para ser embutido no site do buffet (`/f/*` libera iframe), mas não há **código de incorporação**, QR code nem botão de compartilhar no WhatsApp | "Incorporar" (snippet de iframe), QR code, "Compartilhar" |
| UX-078 | Baixa | Melhoria | Respostas: coluna "Natureza" mostra os códigos `B2B`/`B2C`; não dá para ver a resposta completa sem abrir o evento; sem exportação nem filtros | Rótulos legíveis, detalhe da resposta em drawer, exportar CSV |
| UX-079 | Baixa | Inconsistência | O card de formulário mostra só o caminho (`/f/slug`); o botão "Copiar link" copia a URL completa | Mostrar a URL completa |

### 3.5 Funil de vendas (Kanban e lista)

| ID | Sev. | Tipo | Problema | Sugestão |
|---|---|---|---|---|
| UX-100 | Média | Erro | O botão laranja de largura total em cada card diz **"Editar"**, mas abre o **resumo** (a edição é outra página). Além de mal nomeado, repete-se em todos os cards e pesa visualmente | Card inteiro clicável (abre o resumo) + menu "⋯" (Editar, Mover para…, Abrir orçamento) |
| UX-101 | Média | Erro | O card mostra "Orçamento" ou "**Budget**" conforme exista orçamento, e **a soma da coluna mistura os dois** (valor proposto + verba estimada) | Somar só orçamentos (ou mostrar os dois totais separados); substituir "Budget" por "Verba estimada" com estilo diferente |
| UX-102 | Média | Melhoria | Cards grandes (28 px de padding, 4 linhas, tags, botão): cabem 2–3 por tela, e as colunas não rolam separadamente | Card compacto (cliente, data, pessoas, valor) com detalhes no hover/expandir; rolagem por coluna |
| UX-103 | Média | Erro | O card é soltado na posição escolhida, mas a ordem não é salva; ao recarregar, volta a ordenar por data | Não sugerir reordenação (soltar sempre no lugar da data) ou salvar a ordem |
| UX-104 | Média | Melhoria | Mover para aprovado ou recusado não pede motivo de perda nem próximo passo; não há "desfazer" no toast | Modal curto em transições-chave (motivo da recusa, data de fechamento); "Desfazer" no toast |
| UX-105 | Baixa | Inconsistência | O filtro de status só existe na visão Lista; os filtros ficam num `<details>` que não fecha ao clicar fora; a busca exige Enter, sem botão | Filtros em barra horizontal com chips removíveis; busca com botão/debounce |
| UX-106 | Baixa | Melhoria | O card mostra o nome do cliente como título e o título do evento como subtítulo; o título padrão é "Categoria – Cliente", então o nome aparece duas vezes | Título = ocasião + data; subtítulo = cliente |
| UX-107 | Baixa | Melhoria | Sem indicação de tempo parado na etapa (o dashboard já calcula "sem retorno há 7+ dias") | Selo "há 9 dias" no card |

### 3.6 Cadastro e resumo do evento

| ID | Sev. | Tipo | Problema | Sugestão |
|---|---|---|---|---|
| UX-110 | Média | Erro | Checklist: o modelo tem **prazo**, mas a interface não permite definir nem ver o prazo; também não dá para editar o texto de um item (só status e excluir) | Campo de prazo (com destaque de atrasados) e edição inline |
| UX-111 | Média | Inconsistência | "Natureza do evento" e "Forma de pagamento" aparecem dentro do bloco **Responsável**; o cliente aparece duas vezes (faixa superior e card "Cliente / Orçamento") | Reorganizar: Contato \| Evento \| Logística \| Comercial |
| UX-112 | Média | Erro | Sem orçamento, o valor aparece como "**R$ 00**" | "Sem orçamento" + botão "Criar orçamento" |
| UX-113 | Média | Melhoria | O cabeçalho de todas as abas do evento é "Eventos / {nome do cliente}". Com vários eventos do mesmo cliente, as telas ficam indistinguíveis; o breadcrumb não é clicável | "Funil / {título do evento}" com link de volta |
| UX-114 | Média | Melhoria | Formulário do evento com 7 blocos longos numa página só, sem navegação lateral nem indicação do que é essencial; "Duração do evento" é digitada à parte, mesmo com início e término informados; verba total e por pessoa não se calculam uma pela outra | Blocos recolhíveis com essenciais primeiro; calcular duração e verba automaticamente |
| UX-115 | Baixa | Erro | Filtrar categoria pelo tipo usa `option.hidden`, que não funciona no Safari (as categorias de outros tipos continuam visíveis) **(verificar em teste)** | Recriar a lista de opções via JS |
| UX-116 | Baixa | Melhoria | E-mail e WhatsApp do responsável sem ação: não há botão "Chamar no WhatsApp" nem `mailto` | Links `wa.me` e `mailto` |
| UX-117 | Baixa | Melhoria | Trocar o status pelo select da faixa superior recarrega a página inteira, sem confirmação | Salvar via `fetch` com toast e "Desfazer" |

### 3.7 Orçamento, proposta e envio

| ID | Sev. | Tipo | Problema | Sugestão |
|---|---|---|---|---|
| UX-120 | Alta | Erro | **Enviar a proposta não congela a versão.** Depois do envio, a mesma versão continua editável e o autosave segue alterando o que o cliente já recebeu; o histórico diz "Enviada para…" numa versão que mudou | Ao enviar: congelar e abrir a próxima versão automaticamente, ou avisar "esta versão já foi enviada; editar cria a versão N+1" |
| UX-121 | Alta | Erro | Envio sem progresso: o drawer "Enviar" faz um POST que gera o PDF (segundos) e envia o e-mail; o botão não mostra carregamento nem desabilita, e dá para enviar em dobro | Botão com spinner/desabilitado; confirmação com resumo (para quem, qual versão, valor) |
| UX-122 | Média | Melhoria | Sem pré-visualização da proposta na tela: a cada ajuste é preciso baixar o PDF | Aba "Pré-visualizar" (a página `/print` já existe) |
| UX-123 | Média | Melhoria | No envio, sem pré-visualização do e-mail e do anexo; o destinatário é texto livre separado por vírgula | Campo de destinatários em chips com validação; pré-visualizar |
| UX-124 | Média | Inconsistência | O orçamento está dividido entre abas do **evento**: "Orçamento", "Informações complementares" e "Condições gerais" (as duas últimas pertencem à versão do orçamento, e "Condições gerais" também guarda os textos de todas as páginas). O usuário não percebe que essas abas mudam com a versão | Agrupar tudo dentro de Orçamento (sub-abas: Itens \| Informações \| Condições e textos \| Pré-visualização), com a versão sempre visível |
| UX-125 | Média | Inconsistência | Padrões diferentes para adicionar: cardápio (select + botão laranja), seção (select + botão **cinza** "Adicionar nova sessão ao cardápio"), item (select + botãozinho que só aparece depois), bebida e função (select + botão laranja), extra (botão que já insere "Hora adicional" preenchido) | Um só componente "Adicionar ▾" com busca |
| UX-126 | Média | Erro | Campos do orçamento só salvam ao sair do campo (blur) + 800 ms de espera; observações internas também. Fechar a aba ou clicar num link logo após digitar pode perder a última edição **(verificar em teste)** | Salvar também no `input` com debounce; forçar o envio no `pagehide` |
| UX-127 | Baixa | Melhoria | "Pagantes" aparece com decimal (ex.: 118,5) sem explicação | Tooltip: "convidados − isentas − meia × 0,5" |
| UX-128 | Baixa | Erro | Campos numéricos `type=number` mudam de valor com a roda do mouse ao rolar a página | Bloquear a roda ou usar `inputmode="numeric"` |
| UX-129 | Baixa | Melhoria | Descrição do item do cardápio só aparece em tooltip (`title`) no chip, invisível no toque | Mostrar ao expandir o item |
| UX-130 | Baixa | Melhoria | Blocos e textos da proposta sem reordenação; linhas novas nascem como "Novo item" | Arrastar/setas; foco automático no campo novo |

### 3.8 Acompanhamento: dashboard, agenda e linha do tempo

| ID | Sev. | Tipo | Problema | Sugestão |
|---|---|---|---|---|
| UX-090 | Média | Melhoria | A linha do tempo só registra ações automáticas; o comercial não consegue **anotar** contato, visita ou degustação, nem agendar um lembrete | "Nova anotação" com tipo e data de retorno (e lembrete) |
| UX-091 | Média | Inconsistência | Dashboard: o seletor de período vale para os KPIs e para o funil, mas não para "Próximos 30 dias" nem para "Propostas sem retorno", e nada indica isso. O texto "Valores = versão atual de cada orçamento" é técnico | Rotular cada bloco com o seu recorte; frase simples |
| UX-092 | Baixa | Melhoria | KPIs não clicáveis, sem comparação com o período anterior, sem evolução no tempo | Link de cada KPI para a lista filtrada; variação % vs. período anterior |
| UX-093 | Baixa | Melhoria | Agenda sem criar evento clicando no dia; mostra recusados junto (poluição); a visão mensal só distingue etapa pela cor, sem legenda | Clique no dia → novo evento com data; ocultar recusados por padrão; legenda |
| UX-094 | Baixa | Melhoria | Sem visão de lista/dia na agenda e sem exportar para o calendário (ver report.md FUN-09) | Visão "Lista" e iCal |

### 3.9 Cardápio, staff e clientes

| ID | Sev. | Tipo | Problema | Sugestão |
|---|---|---|---|---|
| UX-140 | Média | Inconsistência | Opções de cardápio abrem num editor em tela cheia próprio (Preact), com botões Duplicar/Excluir/Salvar em ordem e estilo diferentes do Drawer; itens e seções usam o Drawer | Um padrão de painel de edição para todo o sistema |
| UX-141 | Média | Erro | Staff › Serviços: o card mostra "Hora extra" e o formulário pede o valor, mas **esse valor não entra no orçamento** | Usar no cálculo (horas extras do evento) ou esconder até ser usado |
| UX-142 | Média | Melhoria | Cliente: a página de detalhe não tem "Editar" (só pela lista) nem mostra o total já contratado | Botão Editar e resumo (eventos, valor aprovado, último contato) |
| UX-143 | Baixa | Melhoria | Profissionais sem histórico de eventos e sem contato rápido | Coluna "último evento"; WhatsApp |
| UX-144 | Baixa | Inconsistência | Ordem de exibição por número digitado (seções, blocos) e por setas com recarga da página (status) | Arrastar para ordenar, salvando via `fetch` |
| UX-145 | Baixa | Melhoria | Itens do cardápio: o drawer troca o título "Editar item" pelo nome do item (padrão diferente dos outros); sem filtro de ativo/inativo; sem duplicar item | Padronizar título "Editar item · Nome"; filtros e duplicar |

### 3.10 Templates e blocos de texto

| ID | Sev. | Tipo | Problema | Sugestão |
|---|---|---|---|---|
| UX-011 | Alta | Erro | (Ver 2.2) criar template com erro apaga tudo | — |
| UX-146 | Média | Erro | "PDF de exemplo" usa a versão **salva**: alterações ainda não salvas não aparecem, e nada avisa. O botão só existe depois do primeiro salvamento | Salvar antes de gerar (ou avisar); disponível já na criação |
| UX-147 | Média | Melhoria | A pré-visualização ao vivo é parcial: página de conteúdo com textos fictícios ("Título", "Subtítulo 1", "Parágrafo 01"); a introdução não é refletida | Pré-visualização com a proposta de exemplo real (mesma renderização do PDF, em miniatura) |
| UX-148 | Baixa | Melhoria | Página longa (identidade, capa, conteúdo, contracapa) com "Salvar" só no topo | Barra de ações fixa |
| UX-149 | Baixa | Erro | Blocos de informação: clicar em outro bloco da lista descarta a edição atual sem avisar; os checkboxes da lista são decorativos e desabilitados (parecem clicáveis) | Aviso de alterações; trocar o checkbox por um selo "Padrão" |

### 3.11 Configurações: usuários e empresa

| ID | Sev. | Tipo | Problema | Sugestão |
|---|---|---|---|---|
| UX-160 | Média | Erro | O papel pode ser trocado de dois jeitos (select na tabela e drawer "Editar"). O select **salva ao mudar**, sem confirmação, inclusive para **Proprietário** | Só no drawer, com confirmação ao conceder Proprietário |
| UX-150 | Média | Erro | Empresa: "Remover" o logotipo envia o formulário com a ação `remover_logo`, que **ignora os demais campos** alterados; o usuário perde o que editou | Remover no próprio salvar (checkbox, como no template) ou via `fetch` isolado |
| UX-151 | Baixa | Melhoria | Modelo de e-mail: variáveis listadas como texto; sem pré-visualização nem clique para inserir | Chips que inserem a variável; pré-visualizar com dados de exemplo |
| UX-152 | Baixa | Melhoria | "Local padrão dos eventos" é pedido, mas não é usado em nenhum lugar do sistema | Usar como sugestão no evento ou remover |
| UX-153 | Baixa | Inconsistência | Categorias: na aba de evento, o nome é link e há "Excluir" na linha; na aba de item, o nome é texto e só há "Editar" | Mesmo padrão nas duas |
| UX-154 | Baixa | Melhoria | Sem página "Minha conta" (nome, telefone, senha) — ver report.md UX-07 | — |

---

## 4. Oportunidades de melhoria de produto (UX estratégica)

1. **Busca global** (Ctrl+K): cliente, evento, item, com resultados agrupados. Hoje cada módulo tem busca isolada.
2. **Central de notificações**: novo pedido do formulário, proposta sem retorno, prazo do checklist vencendo, evento na
   semana.
3. **Ações rápidas no dashboard**: "Novo evento", "Novo orçamento", "Copiar link do formulário".
4. **Modelos de orçamento**: começar de um orçamento anterior semelhante (mesmo tipo e formato), além das opções de
   cardápio.
5. **Página pública da proposta** com "Aprovar/Recusar" (ver report.md FUN-05). Muda o fluxo de "mandar PDF e esperar"
   para acompanhamento.
6. **Ajuda contextual**: usar o ícone "info" do topo para explicar cada tela (hoje decorativo).
7. **Tema e densidade**: modo compacto para listas grandes; tema escuro (opcional).

---

## 5. Backlog priorizado

| Onda | Itens | Esforço |
|---|---|---|
| **1 — Correções que passam impressão errada ou perdem dados** (1–2 semanas) | UX-001, UX-002, UX-003, UX-010, UX-011, UX-100, UX-101, UX-112, UX-120, UX-121, UX-150, UX-160, UX-012 | Baixo a médio |
| **2 — Consistência** (2–3 semanas) | UX-020 (glossário), UX-005, UX-004, UX-006–UX-008, UX-013–UX-018, UX-025–UX-029, UX-019, UX-124, UX-125, UX-140 | Médio |
| **3 — Acessibilidade e mobile** (3–4 semanas) | UX-030, UX-061–UX-067, UX-023, UX-102 | Médio a alto |
| **4 — Fluxos e produtividade** | UX-050–UX-053, UX-070–UX-079, UX-090–UX-094, UX-104, UX-110, UX-114, UX-122, UX-123, UX-141, UX-142, UX-146, UX-147 e seção 4 | Variável |

**Primeiro passo sugerido:** a onda 1 se resolve em poucos arquivos: `AuthLayout.astro`, `validacao.astro`,
`empresa.astro`, a página do Kanban, `Toast.astro` e o fluxo de envio. A UX-010 pede um ajuste central no `Drawer` e
em `handleFormPost`, que corrige de uma vez todas as telas de cadastro.

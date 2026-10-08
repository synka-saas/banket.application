# Banket SaaS — Estrutura Oficial de Planos Comerciais

Este documento consolida a arquitetura comercial do **Banket**, SaaS multi-tenant voltado para gestão operacional, orçamentária, de suprimentos e de relacionamento de buffets e casas de eventos.

> **Atualização de 07/10/2026:** inclui os módulos lançados nesta data — Lista de Compras por evento, Estoque, Reuniões com Google Meet (login com Google), Assistente de Negociação IA, Assistente de Orçamentos IA e margem projetada do orçamento — e o catálogo completo de funcionalidades (seção 5). A distribuição desses novos recursos entre os planos (linhas marcadas com **★**) é uma proposta e precisa ser validada pela área comercial.

## 1. Glossário de Conceitos e Modulagem

As ferramentas do sistema estão divididas funcionalmente em quatro grandes grupos:

* **Gestão Administrativa:** Ferramentas operacionais de governança e parametrização do negócio (gerenciamento do funcionamento do sistema, estrutura de catálogo, disposições visuais, espaços físicos, alocação de equipe e métricas de desempenho).
* **Gestão de Relacionamento (CRM & Vendas):** Toda a dinâmica de interação direta e captação do cliente final (captação via formulários públicos, cadência no Painel de Propostas, geração e versionamento de orçamentos, disparos/rastreamento de propostas, conversas por e-mail, reuniões e contratos).
* **Operação & Suprimentos:** Planejamento do que o evento consome e controle do que a casa tem (lista de compras por evento a partir da porção por pessoa, estoque de consumíveis e não consumíveis, movimentações rastreáveis e base de custo para o CMV).
* **Inteligência Artificial:** Assistentes que leem o histórico e os números do sistema para recomendar ações (negociação, composição do orçamento, identidade visual das propostas). As recomendações são sempre revisadas e aplicadas pelo usuário.

### Critérios de Disponibilidade (Legenda da Matriz):
* **Básico / Transversal (Cinza / Azul):** Disponível para todos os planos sem restrição funcional interna.
* **Limitado / Padronizado (Vermelho):** Sujeito a limite numérico estrito ou travado no layout/etapas padrão (sem permissão de personalização).
* **Livre / Ilimitado (Verde):** Acesso completo, sem teto de quantidade e com liberdade total de customização.
* **—:** Não incluído no plano.

---

## 2. Matriz Geral de Funcionalidades

| Módulo / Recurso | Essencial | Profissional | Prime |
| :--- | :--- | :--- | :--- |
| **Suporte** | Básico (Padrão) | Básico (Padrão / Prioritário) | Básico (Prioritário / Dedicado) |
| **Configurações Gerais** | Padrão da plataforma | Padrão da plataforma | Padrão / Avançado |
| **Acesso: e-mail e senha, link de acesso, login com Google** ★ | Básico | Básico | Básico |
| **Usuários e papéis (Proprietário, Administrador, Usuário)** ★ | Limitado (a definir) | Limitado (a definir) | Ilimitado |
| **Dashboard e indicadores** | Básico | Básico | Básico |
| **Templates de Proposta (PDF)** | **1 template** | **3 templates** | **Ilimitados / Personalizados** |
| **Identidade visual com IA nos templates** ★ | — | Sugestão de fontes e cores pelo logotipo | Sugestões + **fundos gerados por IA** |
| **Envio de Propostas** | **Apenas Download Manual do PDF** (envio por conta própria) | **Envio Direto Integrado via Resend** (disparo no sistema + respostas) | **Envio Direto Integrado via Resend** (disparo no sistema + respostas) |
| **Inbox (conversas por e-mail com o cliente)** ★ | — | Livre | Livre |
| **Modelos de e-mail** ★ | — | Livre | Livre |
| **Documentos e contratos (modelos com variáveis, PDF numerado)** ★ | **1 modelo** (download do PDF) | **3 modelos** + envio pelo Inbox | **Ilimitados** + envio pelo Inbox |
| **Reuniões com Google Meet (agenda Google do usuário)** ★ | — | Livre | Livre |
| **Espaços Físicos / Salões** | Básico | Básico | Básico / Ilimitado |
| **Staff (Equipe Operacional)** | Básico | Básico | Básico |
| **Agenda de Eventos** | Básica | Básica (+ reuniões) | Básica / Multi-visão (+ reuniões) |
| **Cardápios Cadastrados** | **Até 3 cardápios** | **Até 7 cardápios** | **Ilimitado** |
| **Porção por pessoa e custo por item do cardápio** ★ | Básico | Básico | Básico |
| **Lista de Compras por evento (CSV e PDF)** ★ | Básico (porção × convidados, ajuste manual) | Livre (+ cobertura pelo estoque) | Livre (+ cobertura pelo estoque) |
| **Estoque e movimentações** ★ | — | **Limitado** (até 200 itens) | **Livre** (ilimitado, base de CMV por evento) |
| **Margem projetada do orçamento** ★ | — | Básico | Básico |
| **Assistente de Negociação IA** ★ | — | **Limitado** (30 análises/mês, somadas aos demais assistentes) | **Livre** |
| **Assistente de Orçamentos IA** ★ | — | **Limitado** (cota compartilhada acima) | **Livre** (+ sugestões de giro de estoque) |
| **Importação de clientes e itens por CSV** ★ | Básico | Básico | Básico |
| **Módulo: Gestão Administrativa** | **Limitado** (Visões e regras padrão) | **Limitado** (Visões e regras padrão) | **Livre** (Total controle e customização) |
| **Módulo: Gestão de Relacionamento** | **Limitado** (Fluxo padrão, sem automações/envios) | **Livre** (Fluxo flexível, envio integrado Resend) | **Livre** (Fluxo flexível, envio integrado Resend) |
| **Painel de Propostas (Kanban)** | **Fixo** (Etapas padrão, não editável) | **Livre** (Etapas e campos customizáveis) | **Livre** (Múltiplos funis e customizável) |
| **Formulários Públicos de Captura** | **1 formulário** | **3 formulários** | **Ilimitados** |
| **Aplicativo no celular (navegador, layout responsivo)** ★ | Básico | Básico | Básico |

---

## 3. Detalhamento dos Planos

### Plano 1: Essencial

> **Foco:** Profissionais autônomos, buffets a domicílio/volantes e operações iniciantes que buscam sair do amadorismo (Word, Excel e PDFs manuais) com investimento acessível.

#### Recursos Inclusos e Capacidade:
* **Templates de Proposta:** 1 modelo padrão disponível para geração de PDF.
* **Envio de Propostas:** **Somente Download do PDF.** O usuário gera o arquivo final e realiza o envio por conta própria (via WhatsApp pessoal, e-mail próprio, etc.). Não há integração de disparo direto pelo sistema.
* **Catálogo de Cardápios:** Até 3 cardápios ativos cadastrados, com porção por pessoa, custo e preço por item.
* **Orçamento:** Construtor completo com cálculo automático (pagantes, cardápios, bebidas, staff, locação e extras), versionamento e prévia do PDF.
* **Lista de Compras:** Quantidade de cada item do evento calculada pela porção por pessoa × convidados, com ajuste manual, marcação de comprado, linhas avulsas e exportação em CSV e PDF.
* **Documentos:** 1 modelo de contrato com variáveis do evento, gerado em PDF numerado para download.
* **Formulários de Captação:** 1 formulário público para divulgação (link na bio do Instagram/WhatsApp).
* **Painel de Propostas (Kanban):** Etapas fixas e padronizadas (ex: *Novo orçamento*, *Em negociação*, *Aprovado*, *Recusado*), sem permissão para renomear, reordenar ou criar novas fases.
* **Gestão Administrativa (Limitada):** Acesso às configurações estruturais padrão, cadastro essencial de itens e visualização predefinida do sistema.
* **Gestão de Relacionamento (Limitada):** Registro manual de interações (linha do tempo com anotações e retornos combinados) e download local da proposta, sem mensageria ou automações integradas.
* **Recursos Compartilhados:** Cadastro de Espaços, Alocação básica de Staff, Agenda de eventos centralizada, Dashboard, Clientes, importação por CSV, login com Google, Configurações de conta e Suporte padrão.

---

### Plano 2: Profissional

> **Foco:** Buffets consolidados com equipe comercial e operacional ativa, salão físico próprio e necessidade de personalização e agilidade comercial para aumentar a conversão.

#### Recursos Inclusos e Capacidade:
* **Templates de Proposta:** Até 3 modelos de PDF distintos (ex: modelo Casamento sofisticado, modelo Corporativo enxuto e modelo Infantil temático), com sugestão de fontes e cores por IA a partir do logotipo.
* **Envio de Propostas:** **Envio Integrado via Sistema (API Resend).** Disparo de e-mails diretamente da tela do orçamento com a proposta anexada, incluindo rastreamento de entrega e recebimento de respostas diretamente integradas.
* **Inbox:** Conversas por evento com o cliente (enviadas e recebidas), anexos, status de entrega, contador de não lidas e modelos de e-mail com variáveis.
* **Reuniões com Google Meet:** Agendamento de degustações, visitas e alinhamentos direto no evento; a reunião e a sala do Meet são criadas na agenda Google do próprio usuário, com convite aos participantes.
* **Documentos:** Até 3 modelos de contrato/documento, com envio pelo Inbox.
* **Catálogo de Cardápios:** Até 7 cardápios ativos completos com ficha técnica/itens.
* **Estoque (Limitado):** Até 200 itens consumíveis e não consumíveis, movimentações com motivo (compra com NF, consumo em evento, perda, quebra, transferência, contagem), custo médio e alertas de mínimo e validade. A Lista de Compras mostra o que o estoque já cobre.
* **Margem projetada e Assistentes de IA (Limitado):** Margem de alimentos e bebidas calculada a cada alteração do orçamento; Assistente de Negociação IA e Assistente de Orçamentos IA com cota de 30 análises por mês.
* **Formulários de Captação:** Até 3 formulários públicos independentes (ex: um formulário para festas infantis, um para eventos sociais e outro corporativo).
* **Painel de Propostas (Kanban):** **Livre e Personalizável.** Permite adicionar, remover e ordenar colunas de acordo com a jornada comercial da casa.
* **Gestão de Relacionamento:** **Livre.** Gestão ampla de contatos, histórico unificado de propostas, múltiplos versionamentos e comunicação centralizada por e-mail.
* **Gestão Administrativa (Limitada):** Funcionalidades administrativas estruturadas segundo os padrões do sistema, sem customização profunda de telas ou regras operacionais.
* **Recursos Compartilhados:** Cadastro de Espaços, Alocação de Staff, Agenda unificada (eventos e reuniões), Configurações da plataforma e Suporte prioritário.

---

### Plano 3: Prime

> **Foco:** Grandes casas de festas, multi-ambientes, redes de buffets e operações com alto volume que exigem customização irrestrita tanto do fluxo de vendas quanto da governança administrativa.

#### Recursos Inclusos e Capacidade:
* **Templates de Proposta:** **Ilimitados e 100% customizáveis** (layouts, paleta visual e tipografia corporativa), com fundos de capa, conteúdo e contracapa gerados por IA.
* **Envio de Propostas:** **Envio Integrado via Sistema (API Resend)** com suporte a volumes maiores, remetente corporativo próprio e histórico completo de comunicação.
* **Documentos:** Modelos de contrato **ilimitados**, cada um com identidade visual própria.
* **Catálogo de Cardápios:** **Ilimitado.** Liberdade total para montar variações sazonais, pacotes especiais e múltiplos menus.
* **Estoque (Livre):** Itens ilimitados, transferências entre espaços e custo gravado em cada saída como base do CMV por evento (custo real × orçado).
* **Assistentes de IA (Livre):** Assistente de Negociação IA e Assistente de Orçamentos IA sem cota mensal, incluindo sugestões de giro de estoque (pratos que aproveitam insumos parados ou perto do vencimento) e substituições de maior margem aplicáveis com um clique.
* **Formulários de Captação:** **Ilimitados**, segmentados por tipo de evento, campanhas de tráfego pago ou salões parceiros.
* **Painel de Propostas (Kanban):** **Livre e Multi-Funil.** Criação de múltiplos funis simultâneos por segmento de venda.
* **Gestão Administrativa:** **Livre.** Controle pleno de como as informações, relatórios, dashboards e telas de gestão são organizados, com parametrização detalhada de fluxos internos de trabalho.
* **Gestão de Relacionamento:** **Livre.** Relacionamento omnicanal, histórico irrestrito de versões e comunicação integrada.
* **Recursos Compartilhados:** Gestão multi-espaço, controle avançado de Staff por salão/turno, Agenda analítica e Suporte prioritário com acompanhamento.

---

## 4. Resumo de Diferenciação Estratégica

| Alavanca de Upgrade | Do Essencial para o Profissional | Do Profissional para o Prime |
| :--- | :--- | :--- |
| **Comunicação & Envio** | **Desbloqueia envio automático via Resend** (no Essencial é apenas download do PDF), Inbox e modelos de e-mail. | Mantém envio integrado via Resend com suporte a múltiplos remetentes/linhas. |
| **Vendas & CRM** | Libera customização total do Painel de Propostas, expande de 1 para 3 formulários e libera reuniões com Google Meet. | Habilita múltiplos funis e formulários ilimitados. |
| **Cardápios** | Aumento de mais do que o dobro (de 3 para 7 cardápios). | Fim de qualquer trava de catálogo (ilimitado). |
| **Templates** | Salto de 1 para 3 opções visuais de apresentação de orçamento, com sugestão de identidade visual por IA. | Criação irrestrita de propostas para múltiplas marcas/linhas e fundos gerados por IA. |
| **Documentos e contratos** | De 1 para 3 modelos, com envio pelo Inbox. | Modelos ilimitados. |
| **Suprimentos** ★ | Libera o Estoque (até 200 itens) e a cobertura da Lista de Compras pelo estoque. | Estoque ilimitado e base de CMV por evento. |
| **Inteligência Artificial** ★ | Libera os dois assistentes de IA com cota mensal e a margem projetada. | Assistentes sem cota, com sugestões de giro de estoque. |
| **Administração** | Mantém a governança estrutural padrão. | Desbloqueia total controle de exibição, regras e gestão de dados. |

---

## 5. Catálogo Completo de Funcionalidades

Inventário do que o sistema oferece, por módulo. Itens marcados com **(novo)** foram lançados em 07/10/2026.

### 5.1 Acesso, conta e empresa
* Cadastro self-service com confirmação de e-mail e cadastro da empresa (PF com CPF ou PJ com CNPJ e razão social), já com etapas, formatos de serviço, categorias, espaço padrão, template, blocos de texto, formulário e contrato de exemplo.
* Login por e-mail e senha (com "manter conectado"), link de acesso sem senha, recuperação de senha e **login com Google (novo)**.
* Usuário em várias empresas, com troca da empresa ativa; convites por e-mail com validade de 7 dias.
* Papéis: Proprietário, Administrador e Usuário (sem acesso a Configurações); regras que garantem ao menos um proprietário ativo.
* Minha conta: dados pessoais, troca de senha, empresas e **Conta Google (novo)** — vincular, desvincular e ativar a agenda.
* Segurança: dados de cada empresa isolados das demais, proteção contra tentativas repetidas de login e arquivos acessíveis só pela própria empresa.
* Gestão do plano e da assinatura pela administração do Banket; termos de uso e política de privacidade.

### 5.2 Dashboard
* Indicadores por período (30, 90, 365 dias ou tudo): pedidos recebidos, pipeline em negociação, aprovados, recusados, taxa de conversão e ticket médio.
* Funil por etapa, próximos eventos, orçamentos parados há mais de 7 dias e retornos combinados nas anotações.
* Primeiros passos para empresas novas.

### 5.3 Painel de Propostas (Kanban) e eventos
* Kanban com as etapas da empresa (arrastar e soltar, cores próprias) e visão em lista paginada; filtros por busca, período, tipo, formato e etapa; intervalo de trabalho configurável; exportação CSV.
* Etapas de fechamento: motivo da perda ao recusar e data ao aprovar, com desfazer.
* Ficha do evento com briefing completo: cliente (novo ou existente), tipo, ocasião, formato de serviço, data e horário, convidados e perfil, espaço, infraestrutura, verba, forma de pagamento, qualificação, responsável, estilo gastronômico, bebidas, restrições alimentares, compliance e comentário do cliente.
* Checklist operacional com prazo e status; linha do tempo automática de tudo o que acontece, com anotações manuais (ligação, WhatsApp, visita, degustação) e data de retorno.

### 5.4 Orçamento e proposta
* Construtor com salvamento automático: pagantes (meia e isentas), cardápios a partir de opções prontas ou do catálogo, bebidas, staff dimensionado por regra, locação pelo espaço e faixas de convidados, extras e valor final manual.
* Recálculo automático com ajuste manual em todos os níveis; versionamento (versões congeladas e restauração).
* Informações complementares e condições gerais com linhas automáticas (equipe, restrições), blocos de texto reutilizáveis e prévia.
* PDF da proposta com capa, conteúdo e contracapa conforme o template; envio por e-mail com a proposta anexada, modelo de e-mail e congelamento da versão enviada.
* **Margem projetada (novo):** custo dos insumos (custo por porção × convidados), margem de alimentos e bebidas e custo por convidado, atualizados a cada alteração.
* **Lista de Compras (novo):** porção por pessoa × convidados de cada item selecionado (soma o mesmo item em cardápios diferentes; bebidas por unidade usam a quantidade do orçamento), ajuste manual, marcação de comprado, observações, linhas avulsas, coluna de cobertura pelo estoque ("Em estoque", "Faltam X", "Sem estoque") e exportação em CSV e PDF (lista simples para conferência).

### 5.5 Templates de proposta
* Templates com fontes, cores, logotipo, imagens e textos de capa, conteúdo, rodapé e contracapa; template padrão; duplicar; PDF de exemplo.
* IA para sugerir fontes e cores a partir do logotipo e para gerar imagens de fundo, guardadas numa galeria da empresa.
* Blocos de informação por página da proposta com formatação simples.

### 5.6 Inbox e comunicação
* Conversas por evento com o cliente, iniciadas no envio da proposta ou em "Nova mensagem"; as respostas do cliente chegam direto ao sistema.
* Status de entrega (entregue, devolvida, falhou), anexos recebidos, arquivamento, busca e filtros; proprietários e administradores veem todas as conversas, cada usuário vê as suas.
* Modelos de e-mail com variáveis (cliente, evento, data, empresa, valor, versão) e modelo padrão.

### 5.7 Reuniões (novo)
* Agendamento pela aba Reuniões do evento ou pela página Reuniões (com ou sem evento): data, horário, duração, local, participantes e pauta.
* A reunião é criada na agenda Google do usuário, com sala do Google Meet e convite por e-mail aos participantes; alterações e cancelamentos também chegam aos participantes.
* Disponível para quem entra com o Google ou vincula a conta Google com acesso à agenda; reuniões aparecem na Agenda e na linha do tempo do evento.

### 5.8 Documentos e contratos
* Modelos com variáveis do evento, cliente, empresa e orçamento (inclusive valores e datas por extenso), campos extras preenchidos na geração, editor com barra de formatação e prévia ao vivo.
* Identidade visual própria por modelo (logotipo, rodapé, fontes e cores), bloco de assinaturas e testemunhas.
* Geração no evento com numeração anual por empresa, PDF guardado, download e envio pelo Inbox.

### 5.9 Cardápios
* Seções, itens e categorias (principal e secundária); opções prontas (pacotes) com seções, "escolha N" e preço por pessoa.
* Item com preço de venda, cobrança por pessoa ou unidade, custo por porção, formato recomendado, composição, restrições alimentares, dados operacionais, **porção por pessoa (novo)** e **"Gerenciado no estoque" (novo)**.
* Importação de itens por CSV (inclui porção) e duplicação de itens e opções.

### 5.10 Estoque (novo)
* Itens consumíveis (ingredientes, produtos prontos como o croissant do cardápio) e não consumíveis (louças, talheres, taças, equipamentos), com categoria, unidade (un, kg, g, l, ml), saldo, estoque mínimo, custo médio, local de armazenamento e validade.
* Resumo com itens ativos, abaixo do mínimo, zerados e valor em estoque; filtros por tipo, categoria e situação (abaixo do mínimo, zerado, vencendo em 15 dias, inativo).
* Movimentações com motivo e campos exigidos por motivo:
  * Entradas: compra (fornecedor e nota fiscal; recalcula o custo médio), devolução/retorno de evento, ajuste de inventário por sobra, produção interna, transferência entre espaços e bonificação de fornecedor.
  * Saídas: consumo em evento e degustação comercial (vinculadas ao evento), perda/vencimento, quebra/avaria, consumo interno da equipe, ajuste por falta, transferência entre espaços e devolução ao fornecedor (com justificativa).
  * Contagem física (inventário), que registra a diferença.
* Histórico de movimentações com filtros; cada saída grava o custo médio do momento (base do CMV por evento).
* Itens do cardápio ligados ao estoque pelo botão "Gerenciado no estoque".

### 5.11 Clientes
* Cadastro PF e PJ com CPF/CNPJ validado, e-mail e documento únicos por empresa, histórico de eventos e importação por CSV.

### 5.12 Agenda
* Visões de mês e semana, eventos coloridos pela etapa, filtro por etapa e **reuniões agendadas (novo)**.

### 5.13 Formulários de captação
* Formulários públicos baseados no modelo do Banket (social e corporativo), com seções e perguntas ativáveis, obrigatoriedade, ordem, perguntas condicionais e personalizadas.
* Página pública incorporável no site, link, QR Code e compartilhamento por WhatsApp; prévia; confirmação por e-mail para quem preencheu.
* Cada envio cria o cliente (ou reaproveita) e o evento na entrada do Painel de Propostas; respostas com detalhe, filtro por período e exportação CSV.

### 5.14 Staff
* Serviços/funções com cachê, hora extra, auxílio e regra de dimensionamento (por evento, por convidados ou mínimo), usados no orçamento; base de profissionais com especialidade, documento e Pix.

### 5.15 Espaços
* Espaços próprios (locação calculada por faixas de convidados) e de terceiros (contato e valor de referência), espaço padrão da empresa e vínculo com eventos e orçamento.

### 5.16 Inteligência Artificial (novo)
* **Assistente de Negociação IA** (aba do evento): consolida o histórico da negociação — dados do evento e do cliente, propostas e envios, reuniões, linha do tempo, e-mails do Inbox e respostas do formulário — e entrega a temperatura do fechamento (fria, morna ou quente, com probabilidade, estágio e urgência), objeções com evidência e gravidade, sugestões de abordagem com roteiro pronto para copiar, sinais positivos, próximos passos e o que falta saber.
* **Assistente de Orçamentos IA** (sub-aba do orçamento): mostra a margem projetada e o custo por item, os insumos do estoque vencendo ou parados, e pede à IA substituições de maior margem (mesma seção, custo menor, equivalência gastronômica e restrições respeitadas) e pratos que aproveitam o estoque; cada sugestão mostra o impacto no custo do evento e pode ser aplicada com um clique.
* Histórico de análises por evento, com o material analisado pela IA disponível para conferência.

### 5.17 Configurações e suporte
* Usuários e convites; tipos de evento, ocasiões, etapas do Painel de Propostas (nome, função, cor, ordem e intervalo do Kanban), formatos de serviço, modelos de e-mail e dados da empresa (logotipo, validade da proposta, faixas de idade das crianças, espaço padrão e assinatura).
* Suporte: chamados abertos no sistema e acompanhados pelo usuário.


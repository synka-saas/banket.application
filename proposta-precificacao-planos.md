# Banket — Proposta de nova precificação e distribuição de ferramentas

> **Status:** proposta para decisão comercial · 11/10/2026
> **Substitui (quando aprovada):** preços do site (`site/index.html` e `site/assets/js/site.js`) e a matriz de
> [especifica_o_de_planos_comerciais_banket.md](especifica_o_de_planos_comerciais_banket.md).
> **Premissas:** Prime abaixo de R$ 300/mês; limites de 20 itens no Prime (templates, cardápios, formulários etc.);
> as ferramentas novas formam o pacote **Concierge**, presente no Profissional e no Prime.

---

## 1. Resumo da proposta

| | **Essencial** | **Profissional** | **Prime** |
| :--- | :---: | :---: | :---: |
| Mensal | **R$ 97** | **R$ 197** | **R$ 297** |
| Anual (2 meses grátis) | R$ 970/ano · ≈ R$ 81/mês | R$ 1.970/ano · ≈ R$ 164/mês | R$ 2.970/ano · ≈ R$ 248/mês |
| Para quem | Autônomo, buffet a domicílio/volante | Buffet com salão e equipe comercial | Casa de eventos grande, vários salões |
| Concierge | — | **Concierge** (com cotas) | **Concierge Completo** |
| Templates · cardápios · formulários · contratos | 1 · 3 · 1 · 1 | 5 · 10 · 5 · 5 | **20 · 20 · 20 · 20** |
| Usuários · espaços | 2 · 1 | 5 · 3 | 15 · 10 |

Para quem passar dos limites do Prime: **pacotes adicionais** (seção 7) ou o plano **Redes, sob consulta**.

O que muda em relação ao modelo atual (R$ 89/197/447 no anual; R$ 127/297/597 no mensal):

1. **Prime cai de R$ 597 para R$ 297 no mensal** e troca o "ilimitado" por limites altos e claros (20).
2. **Escada simples de R$ 100**: 97 → 197 → 297. Cada degrau tem um motivo forte de upgrade (seção 6).
3. **Desconto anual de 34% vira "2 meses grátis" (≈ 17%)**. O desconto atual é agressivo para um produto em
   pré-lançamento e fazia o mensal parecer caro; "2 meses grátis" é fácil de entender e de comunicar.
4. **As ferramentas novas viram um pacote com nome — Concierge** — em vez de uma lista solta de recursos.
5. **Nada de "ilimitado" onde há custo variável** (IA, imagens, e-mails, armazenamento): todo plano tem cota.
6. **Saem da oferta as promessas que o sistema ainda não entrega** (seção 9).

---

## 2. Diagnóstico do modelo atual

| Problema | Por que importa |
| :--- | :--- |
| Prime a R$ 597/mês (R$ 447 no anual) | Muito acima do que buffets de médio porte pagam por software de gestão; o Prime vira só "âncora" e quase ninguém o compra. |
| Salto de R$ 250–300 do Profissional para o Prime | O que se ganha no Prime (mais templates, IA sem cota, CMV) não justifica dobrar a mensalidade. |
| "Ilimitado" em IA, templates com fundos por IA e estoque | Custo variável sem teto: um cliente pode gerar centenas de análises e imagens por mês. |
| Promessas sem código por trás | "Vários funis", "remetente corporativo próprio", "staff por salão e turno", "agenda por salão", "gestão administrativa com controle total" e "suporte dedicado" não existem hoje. Vender e não entregar gera churn e reclamação. |
| Ferramentas novas espalhadas pela matriz | Estoque, financeiro, pesquisa, reuniões e IA aparecem como 10 linhas avulsas com "★". O cliente não percebe o conjunto nem o valor. |
| Limites pequenos e quebrados (1/3/7) | 7 cardápios no Profissional é um número sem lógica; buffets com sazonalidade (Páscoa, festas juninas, fim de ano) estouram rápido. |
| Nenhum limite é aplicado hoje | `can()`/`limit()` de `src/lib/hwesta/entitlements.ts` existem, mas nenhuma tela os consulta, e empresa sem snapshot do Manager não sofre restrição. A proposta exige implementação (seção 10). |

---

## 3. Porte dos clientes potenciais

A proposta parte de três perfis. Os números são faixas típicas para orientar o dimensionamento dos limites e devem
ser confirmados com os dados das demonstrações agendadas (campo `notes` da agenda do Manager).

| | **Pequeno** | **Médio** | **Grande** |
| :--- | :--- | :--- | :--- |
| Exemplo | Chef/buffet a domicílio, volante, coffee break | Buffet com salão próprio, casamentos e corporativo | Casa de eventos com vários salões, buffet com 2+ unidades |
| Eventos por mês | até 8 | 8 a 25 | 25 a 80 |
| Pedidos de orçamento por mês | até 20 | 20 a 80 | 80 a 300 |
| Quem usa o sistema | 1–2 pessoas (dono + ajudante) | 3–5 (dono, comercial, operação, financeiro) | 6–15 (equipe comercial, produção, financeiro, gerência) |
| Espaços | 0–1 (atende no local do cliente) | 1–3 | 3–10 |
| Cardápios / pacotes ativos | 2–3 | 5–10 | 10–20 |
| Ticket médio do evento | R$ 3 mil a 15 mil | R$ 15 mil a 60 mil | R$ 40 mil a 200 mil |
| Dor principal | Sair do Word/WhatsApp, proposta bonita, não esquecer cliente | Converter mais, organizar a equipe comercial, controlar custos | Margem por evento, estoque, financeiro, padronização entre salões |
| Faturamento mensal típico | até R$ 60 mil | R$ 100 mil a 600 mil | acima de R$ 500 mil |
| Peso do Banket no faturamento | R$ 97 ≈ 0,2% de R$ 50 mil | R$ 197 ≈ 0,1% de R$ 200 mil | R$ 297 ≈ 0,03% de R$ 1 milhão |
| **Plano indicado** | **Essencial** | **Profissional** | **Prime** |

Leitura: o preço não é a barreira para o médio e o grande; a barreira é **perceber o valor**. Por isso o Prime mais
barato e o Concierge com nome próprio — a venda passa a ser "o Banket paga a si mesmo se evitar um item comprado à
toa por mês".

---

## 4. Mapeamento das ferramentas novas (lançadas em 07 e 08/10/2026)

| Ferramenta | O que resolve | Porte que mais aproveita | Custo variável para o Banket | Depende de |
| :--- | :--- | :--- | :--- | :--- |
| **Lista de compras do evento** (PDF/CSV) | Quanto comprar de cada item (porção × convidados) | Todos | Nenhum | Porção por pessoa no cardápio |
| **Porção e custo por item** | Base de custo e de compras | Todos | Nenhum | — |
| **Margem projetada do orçamento** | Saber a margem antes de enviar a proposta | Médio e grande | Nenhum (cálculo local) | Custo por item |
| **Estoque e movimentações** | Saldo, custo médio, perdas, validade, CMV | Médio e grande | Armazenamento (baixo) | — |
| **Cobertura da lista de compras pelo estoque** | Comprar só o que falta | Médio e grande | Nenhum | Estoque |
| **Financeiro: contas e plano de pagamento do evento** | Parcelas acertadas no fechamento, baixas | Todos | Nenhum | — |
| **Financeiro: visão geral, fluxo de caixa, CSV, categorias** | Caixa do mês, vencidos, previsão | Médio e grande | Nenhum | — |
| **Financeiro: contas lançadas pelo estoque e CMV no resultado** | Resultado real do evento | Grande | Nenhum | Estoque |
| **Pesquisa de satisfação (NPS + CSAT)** | Qualidade, depoimentos, indicação | Médio e grande | E-mail (baixo) | Inbox para o envio por e-mail |
| **Reuniões com Google Meet** | Agendar degustação e visita no evento | Médio e grande | Nenhum (API do Google gratuita) | Conta Google do usuário |
| **Login com Google** | Acesso mais simples | Todos | Nenhum | — |
| **Assistente de Negociação IA** | Temperatura do fechamento, objeções, roteiro | Médio e grande (equipe comercial) | **OpenAI por análise** | Histórico do evento (Inbox, timeline) |
| **Assistente de Orçamentos IA** | Trocas de maior margem e giro de estoque | Médio e grande | **OpenAI por análise** | Custo por item; estoque para o giro |
| **Identidade visual por IA** (fontes e cores pelo logo) | Template bonito sem designer | Todos | OpenAI (baixo) | — |
| **Fundos de template gerados por IA** | Capa e páginas exclusivas | Médio e grande | **OpenAI por imagem (o mais caro)** | — |

Conclusões do mapeamento:

* **Lista de compras, porção/custo, plano de pagamento e login com Google** custam zero e prendem o cliente: ficam em
  **todos os planos** (são a porta de entrada para o upgrade).
* **Estoque, financeiro completo, pesquisa completa, reuniões e os assistentes de IA** são o salto de gestão que o
  médio e o grande valorizam: formam o **Concierge**.
* **IA e fundos por imagem** têm custo por uso: entram com **cota mensal** em todos os planos que os oferecem.

---

## 5. Concierge

**Concierge** é o nome comercial do conjunto de ferramentas que acompanha o evento **depois do "sim"** e ajuda a
fechar o próximo: operação, dinheiro, relacionamento e inteligência. A mensagem é *"o Banket cuida do evento do
pedido ao pós-festa"*.

### 5.1 Composição

| Frente do Concierge | Ferramentas | **Profissional** — Concierge | **Prime** — Concierge Completo |
| :--- | :--- | :--- | :--- |
| **Vendas** | Inbox, modelos de e-mail, reuniões com Google Meet, Assistente de Negociação IA | Completo; IA na cota compartilhada | Completo; IA na cota maior |
| **Operação** | Estoque, cobertura da lista de compras, margem projetada, Assistente de Orçamentos IA | Estoque até 300 itens; trocas sugeridas pela IA | Estoque até 2.000 itens; trocas **e giro de estoque** (validade e itens parados) |
| **Financeiro** | Visão geral, fluxo de caixa, categorias, CSV, contas geradas pelo estoque, CMV no resultado do evento | Visão geral, fluxo, CSV, contas do estoque | Tudo, **com o custo real do estoque consumido (CMV)** no resultado de cada evento |
| **Pós-evento** | Pesquisa de satisfação editável, envio por e-mail, lembrete, painel NPS/CSAT | Completo | Completo, com análise por pergunta e por tipo de evento |
| **Cota de IA** (Negociação + Orçamentos, somadas) | — | **40 análises/mês** | **150 análises/mês** |
| **Fundos de template por IA** | — | — | **20 imagens/mês** |

O Essencial **não** tem Concierge, mas vê a vitrine: a lista de compras, o plano de pagamento do evento e a pesquisa
com questionário padrão funcionam, e cada tela do Concierge aparece com a explicação e o botão de upgrade.

### 5.2 Por que o Concierge fica no Profissional (e não só no Prime)

* O Profissional é o plano de maior volume esperado (o médio porte é a maior fatia do mercado de buffets). Tirar dele
  o estoque e o financeiro deixaria o plano sem diferencial contra planilhas.
* O diferencial do Prime passa a ser **escala** (limites, usuários, espaços), **profundidade** (CMV, giro de estoque,
  análise por tipo de evento) e **IA com folga**, não o acesso às ferramentas.

---

## 6. Matriz de funcionalidades proposta

Legenda: ✓ incluído · — não incluído · número = limite.

### 6.1 Vendas e propostas

| Recurso | Essencial | Profissional | Prime |
| :--- | :---: | :---: | :---: |
| Painel de Propostas (Kanban), lista, filtros, CSV | ✓ etapas padrão | ✓ etapas editáveis | ✓ etapas editáveis |
| Orçamento versionado, prévia, PDF | ✓ | ✓ | ✓ |
| Templates de proposta | 1 | 5 | 20 |
| Identidade visual por IA (fontes e cores pelo logo) | 3/mês | 20/mês | 60/mês |
| Fundos de template por IA | — | — | 20/mês |
| Envio da proposta | download do PDF | envio pelo sistema, rastreamento e respostas | idem |
| Formulários públicos de captação | 1 | 5 | 20 |
| Modelos de documento/contrato | 1 (download) | 5 + envio pelo Inbox | 20 + envio pelo Inbox |
| Modelos de e-mail | — | 10 | 20 |
| E-mails enviados pelo sistema por mês | — | 1.000 | 3.000 |

### 6.2 Relacionamento

| Recurso | Essencial | Profissional | Prime |
| :--- | :---: | :---: | :---: |
| Clientes, linha do tempo, anotações e retornos | ✓ | ✓ | ✓ |
| Importação de clientes e itens por CSV | ✓ | ✓ | ✓ |
| Inbox (conversas por e-mail no evento) | — | ✓ | ✓ |
| Reuniões com Google Meet | — | ✓ | ✓ |
| Login com Google | ✓ | ✓ | ✓ |
| Pesquisa de satisfação | questionário padrão, link copiado | editável, envio por e-mail, lembrete, painel | idem + análise por pergunta e tipo de evento |

### 6.3 Operação e suprimentos

| Recurso | Essencial | Profissional | Prime |
| :--- | :---: | :---: | :---: |
| Cardápios (opções prontas ativas) | 3 | 10 | 20 |
| Itens e seções do catálogo | sem limite | sem limite | sem limite |
| Porção e custo por item | ✓ | ✓ | ✓ |
| Lista de compras do evento (PDF/CSV) | ✓ | ✓ + cobertura pelo estoque | ✓ + cobertura pelo estoque |
| Estoque e movimentações | — | 300 itens | 2.000 itens |
| Margem projetada do orçamento | — | ✓ | ✓ |
| Staff calculado por convidados, profissionais | ✓ | ✓ | ✓ |
| Espaços | 1 | 3 | 10 |
| Agenda (mês e semana) | ✓ | ✓ + reuniões | ✓ + reuniões |

### 6.4 Financeiro (proprietário e administrador)

| Recurso | Essencial | Profissional | Prime |
| :--- | :---: | :---: | :---: |
| Plano de pagamento do evento, contas a receber e a pagar, baixa | ✓ | ✓ | ✓ |
| Aba Finanças do evento (resultado previsto) | ✓ | ✓ | ✓ + CMV do estoque |
| Visão geral, fluxo de caixa, categorias próprias, CSV | — | ✓ | ✓ |
| Contas a pagar lançadas pela compra do estoque | — | ✓ | ✓ |

### 6.5 Inteligência artificial

| Recurso | Essencial | Profissional | Prime |
| :--- | :---: | :---: | :---: |
| Assistente de Negociação IA | — | ✓ (cota compartilhada) | ✓ (cota compartilhada) |
| Assistente de Orçamentos IA | — | ✓ trocas de maior margem | ✓ trocas + giro de estoque |
| Cota de análises por mês | — | 40 | 150 |

### 6.6 Conta e suporte

| Recurso | Essencial | Profissional | Prime |
| :--- | :---: | :---: | :---: |
| Usuários ativos | 2 | 5 | 15 |
| Dashboard e indicadores | ✓ | ✓ | ✓ |
| Armazenamento (PDFs, imagens, anexos) | 1 GB | 5 GB | 20 GB |
| Suporte por chamado | ✓ (2 dias úteis) | ✓ prioritário (1 dia útil) | ✓ prioritário (mesmo dia útil) |
| Implantação assistida (importação de cardápios e 1 template montado pela equipe) | pago à parte | pago à parte | **incluída no anual** |
| Eventos, orçamentos, clientes | sem limite | sem limite | sem limite |

**Não limitar eventos, orçamentos nem clientes.** São o uso que gera valor; limitá-los pune justamente o cliente que
está dando certo e incentiva a apagar histórico.

---

## 7. Adicionais e plano acima do Prime

Os limites de 20 dão espaço ao grande porte típico; quem precisar de mais compra pacotes, sem trocar de plano.

| Adicional | Preço sugerido | Disponível em |
| :--- | :--- | :--- |
| Usuário extra | R$ 19/mês cada | Profissional e Prime |
| Espaço extra | R$ 29/mês cada | Profissional e Prime |
| Pacote +10 (templates, cardápios **ou** formulários) | R$ 29/mês cada pacote | Prime |
| +50 análises de IA | R$ 29/mês ou R$ 39 avulso no mês | Profissional e Prime |
| +20 fundos de template por IA | R$ 29 avulso | Prime |
| Implantação assistida | R$ 490 (uma vez) | Todos (incluída no Prime anual) |

**Redes, sob consulta:** empresas com mais de 10 espaços, 15 usuários ou várias unidades. Preço por unidade, limites
negociados. Fica fora da página de preços (botão "Falar com a equipe").

---

## 8. Escada de upgrade (o que faz o cliente subir)

| | Do Essencial para o Profissional (+R$ 100) | Do Profissional para o Prime (+R$ 100) |
| :--- | :--- | :--- |
| Gatilho natural | Segundo vendedor, cliente pedindo a proposta por e-mail, primeiro estoque em planilha | Terceiro salão, sexto usuário, mais de 10 cardápios, cota de IA acabando |
| Comunicação | Envio da proposta pelo sistema, Inbox, reuniões com Meet | E-mails: 1.000 → 3.000/mês |
| Concierge | **Desbloqueia o Concierge** (estoque, financeiro completo, pesquisa completa, IA) | Concierge Completo: CMV real, giro de estoque, análise de pesquisa por tipo |
| Limites | 1→5 templates, 3→10 cardápios, 1→5 formulários, 2→5 usuários, 1→3 espaços | 5→20 templates, 10→20 cardápios, 5→20 formulários, 5→15 usuários, 3→10 espaços |
| IA | 40 análises/mês | 150 análises/mês + fundos por IA |
| Serviço | Suporte prioritário | Implantação assistida no anual, atendimento no mesmo dia útil |

O aviso de limite é o principal vendedor do upgrade: mostrar o uso ("4 de 5 templates") nas listagens e, ao
atingir o teto, explicar o que o plano seguinte libera.

---

## 9. Promessas a retirar da oferta (ou levar para o roadmap)

Hoje constam no site ou na especificação, mas não existem no sistema:

| Promessa | Situação no código | Proposta |
| :--- | :--- | :--- |
| Vários funis no Prime | `status_orcamento` é um único conjunto de etapas por empresa | Retirar; roadmap |
| Remetente corporativo próprio (domínio do buffet) | O envio sai sempre de `MAIL_FROM`; só o nome de exibição muda | Retirar; roadmap (exige domínio verificado por empresa no Resend) |
| Staff por salão e turno | Staff dimensionado só por convidados | Retirar |
| Agenda por salão / "multi-visão" | Agenda filtra por etapa, não por espaço | Retirar (filtro por espaço é simples e pode entrar depois) |
| "Gestão administrativa: controle total e customização" | Não há configuração de telas ou relatórios por plano | Retirar a linha da matriz |
| Suporte dedicado | Chamados pelo `/suporte`, sem gerente de conta | Trocar por "atendimento no mesmo dia útil" |
| Estoque e IA "ilimitados" | — | Substituir pelos limites da seção 6 |

---

## 10. Economia por cliente (estimativa)

Custos variáveis no pior caso (cliente usando toda a cota). Valores aproximados: **conferir as tabelas atuais da
OpenAI e do Resend antes de fechar**.

| Item | Base de cálculo | Profissional | Prime |
| :--- | :--- | :---: | :---: |
| Análises de IA (`gpt-4.1-mini`, ~15 mil tokens por análise) | ~R$ 0,10 por análise | R$ 4 | R$ 15 |
| Identidade visual por IA | ~R$ 0,05 por pedido | R$ 1 | R$ 3 |
| Fundos por IA (`gpt-image`, 1664×2352) | ~R$ 0,50 a 1,20 por imagem | — | R$ 24 |
| E-mails (Resend) | ~R$ 0,005 por e-mail | R$ 5 | R$ 15 |
| Armazenamento e infraestrutura (rateio da VPS) | estimativa | R$ 5 | R$ 10 |
| Meio de pagamento (~5%) | sobre o mensal | R$ 10 | R$ 15 |
| **Custo variável no teto** | | **≈ R$ 25** | **≈ R$ 82** |
| **Margem bruta no pior caso** (mensal) | | **≈ 87%** | **≈ 72%** |

Na prática o uso médio fica bem abaixo do teto (a maioria não usa toda a cota de IA nem gera 20 imagens por mês), o
que deixa a margem real do Prime acima de 85%. A cota de fundos por IA é o item que mais pesa: se o custo por imagem
subir, reduza para 10/mês antes de mexer no preço.

### Receita: o que se troca ao baixar o Prime

Como o Banket está em pré-lançamento, **não há base pagante a migrar**; a comparação é de posicionamento. Com 100
clientes no anual:

| Cenário | Essencial / Profissional / Prime | Receita mensal (atual) | Receita mensal (proposta) |
| :--- | :---: | :---: | :---: |
| Mesmo mix | 40 / 45 / 15 | R$ 19.130 | R$ 14.334 |
| Mix esperado com Prime acessível | 30 / 45 / 25 | — | R$ 16.000 |

A proposta reduz a receita por cliente. Ela se paga se **converter ao menos ~20% mais clientes** do que a tabela atual
converteria e/ou se a venda de adicionais (usuários, espaços, IA) chegar a ~R$ 15 por cliente em média. Acompanhar
as duas métricas nos primeiros 90 dias depois de publicar a tabela.

---

## 11. O que precisa ser implementado

### 11.1 Chaves de plano no Manager Hwesta

Os limites viram `capabilities` no snapshot de `hwesta_entitlements` (o catálogo de planos vive no Manager). Sugestão
de chaves (`-1` = sem limite):

| Chave | Tipo | Essencial | Profissional | Prime |
| :--- | :--- | :---: | :---: | :---: |
| `templates` | limite | 1 | 5 | 20 |
| `cardapios` | limite | 3 | 10 | 20 |
| `formularios` | limite | 1 | 5 | 20 |
| `documento_modelos` | limite | 1 | 5 | 20 |
| `email_modelos` | limite | 0 | 10 | 20 |
| `usuarios` | limite | 2 | 5 | 15 |
| `espacos` | limite | 1 | 3 | 10 |
| `estoque_itens` | limite | 0 | 300 | 2000 |
| `ia_analises_mes` | limite | 0 | 40 | 150 |
| `ia_identidade_mes` | limite | 3 | 20 | 60 |
| `ia_fundos_mes` | limite | 0 | 0 | 20 |
| `emails_mes` | limite | 0 | 1000 | 3000 |
| `armazenamento_mb` | limite | 1024 | 5120 | 20480 |
| `envio_integrado` (envio da proposta, Inbox, documentos por e-mail) | booleano | false | true | true |
| `reunioes` | booleano | false | true | true |
| `kanban_editavel` | booleano | false | true | true |
| `concierge` (estoque, financeiro completo, pesquisa completa, margem, IA) | booleano | false | true | true |
| `concierge_completo` (CMV no resultado, giro de estoque, análise por tipo de evento) | booleano | false | false | true |

### 11.2 Onde aplicar

Consultar `withinLimit()`/`can()` de `src/lib/hwesta/entitlements.ts` no servidor (nunca só na tela):

| Limite | Pontos de criação/reativação |
| :--- | :--- |
| Templates | `salvarTemplate` (criação) e `duplicarTemplate` — [src/server/templates.ts](src/server/templates.ts) |
| Cardápios | `salvarOpcao` (criação e reativação) e `duplicarOpcao` — [src/server/cardapio.ts](src/server/cardapio.ts) |
| Formulários | `criarFormulario`, `duplicarFormulario` e ativação em `salvarFormulario` — [src/server/formularios.ts](src/server/formularios.ts) |
| Modelos de documento | `salvarModelo` e `duplicarModelo` — [src/server/documentos.ts](src/server/documentos.ts) |
| Usuários | convite e reativação — [src/server/convites.ts](src/server/convites.ts), [src/server/usuarios.ts](src/server/usuarios.ts) |
| Espaços | `salvarEspaco` (criação e reativação) — [src/server/espacos.ts](src/server/espacos.ts) |
| Estoque | criação de item e `sincronizarItemCardapio` — [src/server/estoque.ts](src/server/estoque.ts) |
| Cota de IA | contagem do mês em `ia_analises` — [src/server/ia/comum.ts](src/server/ia/comum.ts) (hoje só limita 20 a cada 10 min) |
| Fundos e identidade por IA | [src/server/imagemFundo.ts](src/server/imagemFundo.ts), [src/server/identidadeVisual.ts](src/server/identidadeVisual.ts) |
| E-mails | [src/server/envio.ts](src/server/envio.ts), [src/server/conversas.ts](src/server/conversas.ts) (contar `mensagens` de saída no mês) |
| Booleanos | middleware/rotas de Inbox, reuniões, estoque, financeiro (visão geral) e configuração da pesquisa |

### 11.3 Regras de uso

* **Contam os ativos.** Desativar um cardápio, formulário, modelo ou espaço libera a vaga (templates não têm "ativo":
  contam todos).
* **Rebaixamento nunca apaga dados.** O que exceder o novo limite continua funcionando e visível, mas não se cria nem
  se reativa nada até ficar abaixo do teto. Ferramentas do Concierge perdidas ficam em modo leitura.
* **Cotas mensais** reiniciam no dia 1 (fuso `America/Sao_Paulo`); mostrar "12 de 40 análises neste mês".
* **Empresa sem snapshot** continua sem restrição (regra atual do `entitlements.ts`): útil para contas de teste e
  parceiros.

### 11.4 Site e materiais

* Preços e textos em `site/assets/js/site.js` (`PRECOS`) e `site/index.html` (cards, tabela de comparação,
  "Planos a partir de R$ 89/mês", selo "Economize até 34%", perguntas frequentes sobre templates e estoque).
  Lembrar de subir o `?v=` dos links de CSS/JS (cache do Cloudflare).
* Atualizar [especifica_o_de_planos_comerciais_banket.md](especifica_o_de_planos_comerciais_banket.md) com a matriz da
  seção 6 e retirar as linhas da seção 9.

---

## 12. Decisões em aberto

1. **Nome**: "Concierge" e "Concierge Completo" ou "Concierge" e "Concierge Prime"?
2. **Margem projetada no Essencial?** Custo zero e é um ótimo argumento de venda; a proposta a deixa no Concierge
   para reforçar o upgrade.
3. **Teste grátis**: 14 dias no Profissional (recomendado: é o plano que mostra o Concierge).
4. **Cota de fundos por IA**: 20/mês no Prime ou 10/mês + pacote avulso, conforme o custo real por imagem.
5. **Preço de lançamento**: congelar o preço para os primeiros clientes anuais por 24 meses (gera urgência sem
   desconto permanente).

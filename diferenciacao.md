# Banket Busca: diferenciação entre Perfil Simples (gratuito/Essencial) e Personalizado (Profissional/Prime/Master)

Decisão de 18/10/2026: **o Banket Busca é uma funcionalidade do Banket, não uma plataforma de mídia.** Ele não é
vendido à parte nem tem plano próprio pago: vem dentro dos planos do Banket, em dois níveis de perfil.

Princípio: **o gratuito serve para ser encontrado; o pago serve para converter o pedido em contrato e operar o
evento.** A diferença fica no que o buffet recebe, nunca na experiência de quem procura buffet: quem procura
sempre consegue falar com qualquer buffet, com um toque.

## 1. Planos, preços e níveis

| Plano | Preço | Oferta | Perfil no Busca | Recurso / `busca_perfis.nivel` |
|---|---|---|---|---|
| Busca | gratuito | só pelo Busca (`/auth/cadastro?plano=busca`) | **Simples** | sem `busca_personalizado` / `gratuito` |
| Essencial | R$ 89/mês | pública (site e app) | **Simples** (igual ao gratuito) | sem `busca_personalizado` / `gratuito` |
| Profissional | R$ 197/mês | pública | **Personalizado** | `busca_personalizado` / `cliente` |
| Prime | R$ 297/mês | pública | **Personalizado** | `busca_personalizado` / `cliente` |
| Master | R$ 449/mês | **não pública**: contratada pela equipe, para grandes buffets e redes | **Personalizado**, sem limites | `busca_personalizado` / `cliente` |
| Completo | — | interno (empresas antigas e parceiros) | Personalizado, sem limites | `busca_personalizado` / `cliente` |

- Anual = 10 mensalidades (2 meses grátis): R$ 890, R$ 1.970, R$ 2.970 e R$ 4.490. O site mostra o mensal por
  padrão e o anual como valor por mês (R$ 74,17, R$ 164,17 e R$ 247,50).
- **Recursos ilimitados só no Master** (e no Completo interno). Profissional e Prime têm limites (tabela abaixo).
- Migrations: `044` (dois níveis; Essencial com o Busca do gratuito), `045` (descrições sem "Concierge"),
  `046` (preços, limites e o plano Master). Preços no Stripe: `node scripts/stripe-bootstrap.mjs`.

### 1.1 Limites por plano

| Recurso | Busca | Essencial | Profissional | Prime | Master |
|---|---|---|---|---|---|
| Usuários | 1 | 2 | 5 | 15 | sem limite |
| Espaços | — | 1 | 3 | 10 | sem limite |
| Templates de proposta | — | 1 | 3 | 10 | sem limite |
| Opções de cardápio | — | 3 | 7 | 20 | sem limite |
| Formulários de captação | — | 1 | 3 | 10 | sem limite |
| Modelos de contrato | — | 1 | 3 | 10 | sem limite |
| Modelos de e-mail | — | — | 10 | 20 | sem limite |
| Itens de estoque | — | — | 200 | 1.000 | sem limite |
| Análises de IA por mês | — | — | 30 | 100 | sem limite |
| Fundos de proposta por IA por mês | — | — | — | 20 | sem limite |
| **Fotos no perfil do Busca** | 5 gerais | 5 gerais | 30, em grupos | 60, em grupos | sem limite |
| **Tipos de evento / de serviço no Busca** | 3 / 3 | 3 / 3 | 6 / 6 | 10 / 10 | sem limite |
| Histórico | 3 meses | completo | completo | completo | completo |

Empresas que já passam de um limite não perdem nada: o limite só impede criar novos itens ou reativar. Fotos e tipos
do Busca acima do limite saem do perfil público e voltam quando o plano permitir (`aplicarExcedentesBusca` /
`restaurarBusca` em `trocarPlano`).

### 1.2 O que cada perfil tem (como está no app)

| | Perfil Simples | Perfil Personalizado |
|---|---|---|
| Fotos e tipos | ver 1.1 | ver 1.1, fotos em grupos por evento |
| Selo "Cliente Banket" e prioridade na busca | não | sim |
| Cardápios no perfil | não | sim, só as opções marcadas **"Cardápio público"** no editor da opção (ao lado de "Cardápio ativo") |
| Disponibilidade | "Consultar disponibilidade" | pela agenda do Banket (datas fechadas saem da busca) |
| Pedido no perfil | **Ver contatos** (WhatsApp, telefone, e-mail, Instagram, site) | **Receber orçamento sem compromisso**: formulário do buffet, pedido no Painel de Propostas; + **Falar no WhatsApp** com a mensagem pronta |
| Avaliações | só as já existentes | pela pesquisa de satisfação (nota CSAT e depoimento autorizado), com resposta pública |
| Avisos | e-mail (Essencial) / só no app (Busca) | e-mail e WhatsApp da empresa |
| Painel `/busca/desempenho` | totais e o que deixou de ganhar | por dia, funil até o pedido, tempo de resposta e região |
| Endereço do perfil | `/buffet/<id do perfil>` | gerado do nome do buffet; pode ser trocado na etapa 1, digitando ou pela varinha de IA (até 3 sugestões) |

### 1.3 Onde isso aparece

- **Site** (banket.com.br): seção "Banket Busca" antes de "Para quem é" (o que é, 4 benefícios e os cards Perfil
  Simples × Perfil Personalizado); "Banket Busca Simples" no card do Essencial e "Banket Busca Personalizado" nos do
  Profissional e do Prime; grupo "Banket Busca" na comparação; chamada do Master abaixo dos cards, sem preço
  ("Falar com a equipe").
- **App**: cards de `/planos` com os destaques de cada plano (`DESTAQUES_PLANO`), textos de upsell do Busca com os
  limites de cada plano, comparação completa lida do catálogo.

## 2. Alavancas de diferenciação (da mais forte para a mais fraca)

### 2.1 Conversão do pedido (lead)
- **Personalizado:** pedido pelo formulário do buffet, já no Painel de Propostas, com data, convidados e tipo;
  aviso imediato por e-mail (e WhatsApp quando houver); orçamento em minutos.
- **Simples:** quem procura recebe os contatos e o buffet atende manualmente, fora do Banket.
- Opção a avaliar: o Simples recebe o pedido estruturado pelo Banket com limite por mês ou com o contato do cliente
  visível só dentro do app ("aviso só dentro do app"). Mensagem: "você recebeu 4 pedidos este mês; no Personalizado
  eles entram direto no seu funil".

### 2.2 Avaliações e reputação
- Só quem atende pelo Banket (Personalizado) envia o pedido de avaliação depois do evento e responde às avaliações.
- Nota e taxa de resposta pesam no ranking: o pagante acumula reputação, o gratuito fica parado.

### 2.3 Ranking e destaque
- Bônus de ranking, vagas de destaque e selo "Cliente Banket" para o Personalizado (ver `rankeamento.md`).
- O gratuito continua aparecendo: sem buffets cadastrados, a busca perde quem procura e não vende o plano pago.

### 2.4 Disponibilidade real
- **Personalizado:** "Disponível na data" pela agenda do Banket; datas fechadas saem da busca.
- **Simples:** "Consultar disponibilidade".

### 2.5 Dados e o custo de não pagar
- **Simples:** totais (aparições, visualizações, cliques em contato) e o aviso do que deixou de ganhar: "Você
  apareceu em 120 buscas; 30 pessoas viram seu perfil; 12 abriram seus contatos; buffets personalizados da sua
  região receberam em média X pedidos". Upsell ao lado.
- **Personalizado:** detalhe por dia e por origem, comparação com a região, pedidos e conversão.

### 2.6 Apresentação do perfil (argumento mais fraco, percebido como acabamento)
- **Personalizado:** até 30 fotos (60 no Prime, sem limite no Master) em grupos por evento; cardápios públicos do
  catálogo; até 6 tipos de evento e 6 de serviço (10 no Prime); endereço com o nome do buffet (com sugestões por IA).
- **Simples:** até 5 fotos gerais; até 3 tipos de evento e 3 de serviço; endereço com o código do perfil.

### 2.7 Teste de 30 dias
- O gratuito experimenta o Personalizado por 30 dias, com pedidos entrando no funil. Ao voltar para o Simples, a perda
  é sentida. É a alavanca de conversão mais forte.

## 3. Botões de contato no perfil público

Decisão: **contato com um toque para todos; o pagante tem algo a mais**, nunca menos caminhos que o gratuito.

| | Personalizado | Simples |
|---|---|---|
| Botão principal | **Obter orçamento** (formulário curto, pedido no Painel) | **Ver contatos** |
| Botão secundário | **Falar no WhatsApp / Ver contatos** | — |
| Contatos | link (wa.me, tel:, mailto:) e cópia funcionando | link e cópia funcionando |
| Métrica | clique no contato conta como lead nas métricas do pagante | só no total |

Motivo: quem ainda está pesquisando e quer só tirar uma dúvida ("atende em tal data?") desistiria do formulário e
chamaria o gratuito ao lado. O pagante perderia justamente o contato inicial.

### 3.1 Para não esvaziar o formulário do pagante
- Texto do botão com o benefício para quem pede: "Receber orçamento sem compromisso".
- WhatsApp do pagante com a mensagem já preenchida com data, convidados e tipo do evento: até o contato rápido chega
  qualificado.

### 3.2 O que não fazer
- Não bloquear link nem cópia dos contatos do gratuito: quem procura acha que o site está quebrado, e isso prejudica
  a busca inteira (inclusive os pagantes). O buffet gratuito nem percebe a restrição.
- Não deixar o gratuito inútil a ponto de esvaziar a busca.

## 4. Mensagens (site e upsell)

- **Simples:** "Seu buffet na busca: ser encontrado."
- **Personalizado:** "Aparecer primeiro, mostrar disponibilidade e receber o pedido já pronto para virar orçamento no
  Banket."
- O Essencial (Busca igual ao gratuito) é vendido pela gestão (orçamento, PDF, funil), não pelo Busca. O salto do
  Busca fica no Profissional.
- O Master não tem oferta pública: no site aparece só como chamada ("Grande buffet ou rede de buffets?") e é
  contratado pela equipe.

## 5. Implementação (18/10/2026, migration 047)

1. **Feito.** Perfil público do pagante: "Receber orçamento sem compromisso" + secundário "Falar no WhatsApp" e "Ver
   outros contatos" (no celular, ícone do WhatsApp ao lado de "Obter orçamento").
2. **Feito.** WhatsApp do pagante com a mensagem pré-preenchida pelos critérios da busca (tipo, data, convidados).
3. **Feito.** `busca_metricas_dia.cliques_contato` (e `cliques_orcamento`, que antes não era contado) por
   `POST /api/vitrine/metrica`; painel em `/busca/desempenho`.
4. **Feito.** Painel do Simples com "O que você deixou de ganhar" (média de pedidos dos personalizados da cidade ou do
   estado, com 3+ perfis) e o convite para o teste de 30 dias.
5. **Feito, pela pesquisa de satisfação** (decisão de 18/10/2026): a resposta vira avaliação no Busca (nota = média
   CSAT; sem CSAT, NPS convertido; depoimento só com autorização). A empresa responde publicamente e pode ocultar o
   depoimento (a nota continua). Pesquisas só existem do Profissional para cima, então só o Personalizado acumula nota.
6. **Adiado** (decisão de 18/10/2026): pedido estruturado com limite para o Simples. O Simples segue com "Ver contatos".
7. **Feito.** Ranking conforme `rankeamento.md`.
8. **Novo — tempo de resposta**: cada empresa escolhe 2, 4, 6, 12, 24, 48 ou 72 h em Configurações › Empresa ›
   Parâmetros comerciais (padrão 48 h); o perfil mostra "Responde em até X horas" e o cumprimento (pedidos do Busca e
   dos formulários respondidos no prazo, 90 dias) é a taxa de resposta do ranking.
9. **Novo — avisos no WhatsApp** (Cloud API da Meta, recurso `busca_aviso_whatsapp`): para o número da empresa, com
   aceite e escolha dos avisos — novo pedido, prazo de resposta vencendo (quando restam 25% do prazo, só em prazos
   acima de 12 h), resposta do cliente no Inbox e pesquisa respondida.

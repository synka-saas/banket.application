---
title: Criar e editar um formulário
description: Como criar um formulário de captação a partir do modelo padrão e ajustar seções, perguntas, endereço e mensagem de confirmação.
category: Formulários de captação
order: 1
updatedAt: 2026-10-18
tags: [formularios, captacao, pedidos, perguntas]
---

# Criar e editar um formulário

O formulário de captação é a página pública onde o cliente conta o que imagina para o evento. Cada envio vira um
pedido no **Painel de Propostas**, com cliente e briefing já preenchidos. Todo formulário nasce de um modelo pronto,
pensado para buffets, e você ajusta o que quiser.

> **Disponível em:** planos Essencial, Profissional, Prime e Master · **Quem pode usar:** todos os usuários

## Limites do plano

O limite conta os formulários **ativos** (os inativos não ocupam vaga):

| Plano | Formulários ativos |
|---|---|
| Essencial | 1 |
| Profissional | 3 |
| Prime | 10 |
| Master | sem limite |

Toda empresa já começa com um formulário chamado "Formulário de contato".

## Criar um formulário

1. No menu lateral, clique em **Formulários**.
2. Clique em **Novo formulário**.
3. Em **Nome do formulário**, digite um nome (por exemplo, "Casamentos 2027").
4. Clique em **Criar formulário**. O Banket abre o editor com o modelo padrão de captação.

## O que vem no modelo padrão

O formulário é dividido em etapas (seções), que o cliente preenche uma de cada vez:

1. **Olá! Vamos criar algo inesquecível?** — nome, e-mail, WhatsApp e o tipo do evento: **Corporativo (B2B)** ou
   **Social (B2C)**. Esta seção é **Sempre ativa**.
2. **Onde será o evento?** — **Nosso espaço** ou **Local externo**; para local externo, pergunta sobre a infraestrutura
   da cozinha; região ou CEP.
3. **Dimensionamento (B2B)** — só para eventos corporativos: ocasião, empresa, data, participantes, perfil do público,
   verba, processo de aprovação e requisitos de compliance.
4. **Dimensionamento (B2C)** — só para eventos sociais: ocasião, data, adultos, crianças, staff de terceiros, verba e
   restrições alimentares.
5. **Gastronomia & Experiência** — formato do serviço, bebidas e bar, interesse em degustação.
6. **Detalhes finais** — campo livre para observações.

O cliente só vê a seção de dimensionamento do tipo que escolheu na primeira etapa.

## Editar o formulário

1. Em **Formulários**, clique em **Editar** no card do formulário.
2. Ajuste os dados gerais no topo (veja a tabela abaixo).
3. Ajuste as seções e as perguntas:
   - **Seção ativa**: desligue para tirar a seção inteira do formulário.
   - Chave ao lado de cada pergunta: liga ou desliga a pergunta.
   - **Obrigatória**: marca se o cliente precisa responder.
   - Setas para cima e para baixo: mudam a ordem das perguntas dentro da seção.
   - Perguntas marcadas com cadeado (**Obrigatória**) são essenciais para criar o cliente e o evento e não podem ser
     desligadas.
4. Para incluir uma pergunta sua, clique em **Adicionar pergunta** na seção desejada, preencha os campos e clique em
   **Incluir pergunta**.
5. Clique em **Salvar** na barra inferior. A barra mostra **Alterações não salvas** até você salvar e **Tudo salvo**
   depois.

### Dados gerais

| Campo | O que preencher |
|---|---|
| **Nome do formulário** | Nome interno, para você identificar. |
| **Endereço público** | O final do link (`/f/...`). Use letras minúsculas, números e hífens, com pelo menos 3 caracteres. Precisa ser único. |
| **Status** | Ligado = **Recebendo respostas**. Desligado = **Inativo** (o link para de funcionar). |
| **Descrição interna** | Onde o formulário é divulgado, para quem é. O cliente não vê. |
| **Mensagem após o envio** | Texto que o cliente vê ao enviar. Em branco, aparece uma mensagem padrão de confirmação. |

### Perguntas personalizadas

| Campo | O que preencher |
|---|---|
| **Pergunta** | O texto da pergunta. |
| **Tipo de resposta** | Texto curto, Texto longo, Número, Data, E-mail, Telefone, Lista de opções, Escolha única, Múltipla escolha ou Sim / Não. |
| **Resposta obrigatória** | Se o cliente precisa responder. |
| **Opções (uma por linha)** | Para lista, escolha única e múltipla escolha. Informe pelo menos 2. |
| **Texto de exemplo** | Aparece dentro do campo vazio. |
| **Texto de ajuda** | Explicação curta abaixo da pergunta. |

Perguntas personalizadas têm os botões **Editar** e **Remover**. As perguntas do modelo não podem ser removidas, só
desligadas.

## Outras ações do editor

- **Pré-visualizar**: abre o formulário como o cliente vê, na última versão salva, sem permitir envio. Funciona mesmo
  com o formulário inativo.
- **Respostas**: abre a lista de respostas recebidas.
- **Duplicar**: cria uma cópia com o nome "(cópia)". A cópia nasce **inativa**.
- **Excluir**: apaga o formulário e desativa o link público.

## Perguntas frequentes

### A pergunta Ocasião aparece vazia. Por quê?

As opções de ocasião vêm de **Configurações › Ocasiões**: o formulário corporativo lista as ocasiões ligadas a
Corporativo, e o social, as ligadas a Social. Se nenhuma ocasião estiver ligada ao tipo, a pergunta não aparece para o
cliente. O editor avisa isso ao lado da pergunta.

### Removi uma pergunta. Perco as respostas antigas?

Não. As respostas já recebidas continuam guardadas, com o texto da pergunta da época.

### Não consigo ativar o formulário. O que houve?

Você chegou ao limite de formulários ativos do seu plano. Desative outro formulário ou faça upgrade do plano.

### Apareceu "Este endereço já está em uso".

O endereço público precisa ser único entre todos os buffets do Banket. Escolha outro, por exemplo acrescentando o
nome do buffet.

## Artigos relacionados

- [Compartilhar o formulário](02-compartilhar-formulario.md)
- [Ver as respostas do formulário](03-ver-respostas-do-formulario.md)
- [Como o pedido vira evento](04-como-o-pedido-vira-evento.md)
- [Ocasiões](../19-configuracoes/07-ocasioes.md)
- [Limites do plano](../20-planos-e-assinatura/09-limites-do-plano.md)

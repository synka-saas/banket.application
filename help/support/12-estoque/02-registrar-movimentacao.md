---
title: Registrar movimentação de estoque
description: Como registrar entradas, saídas e contagens físicas para manter o saldo do estoque correto.
category: Estoque
order: 2
updatedAt: 2026-10-18
tags: [estoque, movimentacao, entrada, saida, contagem]
---

# Registrar movimentação de estoque

Toda mudança no saldo de um item é feita por uma movimentação: uma **Entrada** (compra, devolução, produção…), uma
**Saída** (consumo em evento, perda, quebra…) ou uma **Contagem** (inventário físico).

> **Disponível em:** planos Profissional, Prime e Master · **Quem pode usar:** todos os usuários

## Antes de começar

O item precisa estar cadastrado e ativo no estoque. Veja [Cadastrar item de estoque](01-cadastrar-item-de-estoque.md).

## Passo a passo

1. No menu lateral, clique em **Estoque**.
2. Clique em **Movimentar** no topo da tela, ou em **Movimentar** na linha do item (o item já vem escolhido). Na tela
   **Movimentações**, o botão se chama **Nova movimentação**.
3. Escolha o **Item**. Logo abaixo aparece o saldo atual.
4. Escolha o **Tipo**: **Entrada**, **Saída** ou **Contagem**.
5. Para entrada e saída, escolha o **Motivo**. Uma explicação curta do motivo aparece embaixo do campo.
6. Informe a **Quantidade**, na unidade do item (indicada embaixo do campo).
7. Preencha os campos que o motivo pedir (fornecedor, nota fiscal, evento, espaço, justificativa ou custo).
8. Clique em **Registrar**.

A mensagem de confirmação mostra o novo saldo do item.

## Como cada tipo altera o saldo

| Tipo | Efeito |
|---|---|
| **Entrada** | Soma a quantidade ao saldo. |
| **Saída** | Subtrai a quantidade do saldo. |
| **Contagem** | Define o saldo pela **Quantidade contada** e registra a diferença. |

Regras:

- Entradas e saídas precisam de quantidade maior que zero.
- **Uma saída não pode ser maior que o saldo.** Se a contagem física for outra, registre uma **Contagem** antes.
- Na contagem, se a quantidade contada for igual ao saldo, não há nada a registrar.

## Campos que dependem do motivo

O formulário mostra só os campos que o motivo usa e marca com asterisco os obrigatórios:

- **Fornecedor** e **Nota fiscal / documento**: compras e devoluções ao fornecedor.
- **Evento**: consumo em evento, degustação e devolução de evento. A lista mostra os eventos que não foram recusados,
  com data a partir de 30 dias atrás ou sem data.
- **Espaço (origem ou destino)**: transferências entre espaços.
- **Custo unitário (R$)**: compra e produção interna. Recalcula o custo médio do item.
- **Justificativa**: perdas, quebras, ajustes de inventário e devoluções ao fornecedor. Nos demais motivos, o campo se
  chama **Observação** e é opcional.

A lista completa está em [Motivos de movimentação](03-motivos-de-movimentacao.md).

## Custo médio e custo das saídas

- Numa compra ou produção interna com custo, o sistema recalcula o **custo médio ponderado** do item. Exemplo: 10 kg a
  R$ 5,00 no saldo + compra de 10 kg a R$ 7,00 = custo médio de R$ 6,00 por kg.
- Uma bonificação entra sem mudar o custo médio.
- Cada saída guarda o custo médio do momento. É assim que a aba Finanças do evento calcula o custo do estoque consumido.

## Perguntas frequentes

### Registrei uma movimentação errada. Posso apagar?
Não. As movimentações ficam no histórico para garantir a rastreabilidade. Registre uma movimentação contrária (por
exemplo, um ajuste de inventário) ou uma contagem com o saldo correto, explicando na observação.

### Por que o botão Movimentar está desativado?
Não há nenhum item ativo no estoque. Cadastre um item primeiro.

### Posso lançar a compra no financeiro ao mesmo tempo?
Sim, se você for Proprietário ou Administrador. Veja [Lançar compra no financeiro](07-lancar-compra-no-financeiro.md).

## Artigos relacionados
- [Motivos de movimentação](03-motivos-de-movimentacao.md)
- [Histórico de movimentações](04-historico-de-movimentacoes.md)
- [Lançar compra no financeiro](07-lancar-compra-no-financeiro.md)
- [Finanças do evento](../11-financeiro/05-financas-do-evento.md)

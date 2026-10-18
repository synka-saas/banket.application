---
title: Plano de pagamento do evento
description: Como cadastrar a entrada e as parcelas acertadas com o cliente e transformá-las em contas a receber.
category: Financeiro
order: 4
updatedAt: 2026-10-18
tags: [financeiro, plano de pagamento, parcelas, entrada, sinal, contas a receber]
---

# Plano de pagamento do evento

O plano de pagamento registra as condições acertadas com o cliente no fechamento do contrato: o valor, a entrada (ou
sinal) e as parcelas do saldo. Cada parcela vira automaticamente uma conta a receber, com o seu vencimento.

> **Disponível em:** planos Profissional, Prime e Master · **Quem pode usar:** Proprietário e Administrador

## Antes de começar

- O evento precisa existir no **Painel de Propostas**. Se ele já tiver orçamento, o valor do plano vem sugerido.
- Combine com o cliente o valor, a entrada e o número de parcelas.

## Cadastrar o plano ao fechar o evento

1. No **Painel de Propostas**, mova o evento para a etapa de aprovado (por exemplo, "Aprovado").
2. Na janela que abre, informe a **Data de fechamento**.
3. Deixe ligada a opção **Cadastrar o plano de pagamento em seguida** e clique em **Confirmar**.
4. O sistema abre a aba **Finanças** do evento com o painel **Plano de pagamento** já aberto.
5. Preencha os campos e clique em **Gerar contas a receber**.

A opção **Cadastrar o plano de pagamento em seguida** só aparece para Proprietários e Administradores.

## Cadastrar o plano a qualquer momento

1. Abra o evento e clique na aba **Finanças**.
2. Em **Contas a receber**, clique em **Plano de pagamento**.
3. Preencha os campos e clique em **Gerar contas a receber**.

## Entenda os campos

| Campo | O que preencher |
|---|---|
| **Valor a receber neste plano (R$)** | Valor total do plano. Já vem sugerido: total do orçamento atual menos o que já foi recebido em planos anteriores. Abaixo aparece o valor do orçamento como referência. |
| **Entrada / sinal (R$)** | Opcional. Valor pago na assinatura do contrato. Não pode ser maior que o valor total. |
| **Vencimento da entrada** | Obrigatório quando há entrada. |
| **Parcelas do saldo** | Em quantas parcelas o restante será pago, de 1 a 60. **1** = pagamento único (à vista). |
| **Vencimento da 1ª parcela** | Data da primeira parcela do saldo. Já vem com um mês a partir de hoje. |
| **Intervalo entre parcelas** | **Mensal**, **Bimestral** ou **Trimestral**. |
| **Forma de pagamento** | Forma combinada, aplicada a todas as parcelas. |
| **Categoria** | Categoria de receita. Sem escolha, usa **Padrão (Venda de evento)**. |

## Prévia das parcelas

Enquanto você preenche, a área **Parcelas geradas** mostra cada parcela com o rótulo, o vencimento e o valor. Se
algo estiver faltando ou inválido, a prévia mostra o motivo (por exemplo, "Informe o vencimento da entrada.").

Como o valor é dividido:

- A entrada é descontada do valor total.
- O saldo é dividido em parcelas iguais. Os centavos que sobram da divisão vão para a última parcela.
- Se a entrada cobrir o valor total, não há parcelas do saldo.

Exemplo: valor de R$ 10.000,00, entrada de R$ 3.000,00 e 3 parcelas mensais geram a entrada de R$ 3.000,00 e três
parcelas de R$ 2.333,33, R$ 2.333,33 e R$ 2.333,34.

## O que acontece depois

- Cada parcela vira uma conta a receber no nome do cliente do evento, com a etiqueta **Plano**. A descrição segue o
  modelo "Título do evento – Entrada", "Título do evento – Parcela 2/3" ou "Título do evento – Parcela única".
- As contas aparecem na aba **Finanças** do evento e em **Financeiro › Contas a receber**.
- A linha do tempo do evento registra o plano cadastrado, com valores e vencimentos.
- O texto do plano pode entrar nos contratos pela variável **{plano_pagamento}**. Veja
  [Variáveis e campos extras](../16-documentos/02-variaveis-e-campos-extras.md).

## Refazer o plano

Se as condições mudarem, clique em **Refazer plano** na aba **Finanças**. O painel passa a se chamar **Refazer plano
de pagamento**.

- As parcelas do plano anterior que ainda estão **em aberto** são substituídas pelas novas.
- As parcelas **já recebidas** continuam como estão. Por isso o valor sugerido desconta o que já foi recebido.

## Perguntas frequentes

### Posso editar uma única parcela?
Sim. Na lista de contas, clique em **Editar** na parcela e ajuste o valor ou o vencimento. Lembre que refazer o plano
substitui todas as parcelas em aberto, inclusive as que você editou.

### O plano muda se eu alterar o orçamento depois?
Não. O plano é independente do orçamento. Se o valor mudar, use **Refazer plano**.

### Posso ter parcelas com formas de pagamento diferentes?
O plano aplica a mesma forma a todas. Depois de gerado, edite cada parcela para mudar a forma, ou informe a forma real
ao registrar o recebimento.

## Artigos relacionados
- [Finanças do evento](05-financas-do-evento.md)
- [Dar baixa, cancelar e reabrir uma conta](03-dar-baixa-cancelar-e-reabrir-conta.md)
- [Mover o evento entre etapas](../03-propostas-e-eventos/04-mover-evento-entre-etapas.md)
- [Gerar documento no evento](../16-documentos/03-gerar-documento-no-evento.md)

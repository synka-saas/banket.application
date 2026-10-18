---
title: Lançar uma conta a receber ou a pagar
description: Como cadastrar e editar contas a receber e a pagar, ligadas a um evento ou da empresa.
category: Financeiro
order: 2
updatedAt: 2026-10-18
tags: [financeiro, contas a receber, contas a pagar, lançamento, despesas]
---

# Lançar uma conta a receber ou a pagar

Use as contas para registrar tudo o que a empresa tem a receber (por exemplo, uma hora adicional cobrada à parte) e
tudo o que tem a pagar (fornecedores, equipe, locação, impostos). A conta pode ficar ligada a um evento ou ser uma
conta geral da empresa.

> **Disponível em:** planos Profissional, Prime e Master · **Quem pode usar:** Proprietário e Administrador

## Antes de começar

- As parcelas que o cliente vai pagar pelo evento são geradas mais rápido pelo
  [plano de pagamento](04-plano-de-pagamento-do-evento.md). Use a conta avulsa para valores fora do plano.
- Se quiser organizar os relatórios, confira as [categorias financeiras](06-categorias-financeiras.md).

## Passo a passo

1. No menu lateral, clique em **Financeiro**.
2. No submenu, clique em **Contas a receber** ou em **Contas a pagar**.
3. Clique em **Nova conta a receber** (ou **Nova conta a pagar**).
4. Preencha os campos (veja a tabela abaixo). Os obrigatórios são **Descrição**, **Valor (R$)** e **Vencimento**.
5. Se a conta já foi quitada, ligue **Já foi recebida** (ou **Já foi paga**) e informe a data em **Recebida em**
   (ou **Paga em**).
6. Clique em **Salvar**.

Você também pode lançar a conta direto pela aba **Finanças** do evento. Nesse caso, ela já nasce ligada ao evento.
Veja [Finanças do evento](05-financas-do-evento.md).

## Entenda os campos

| Campo | O que preencher |
|---|---|
| **Descrição** | O que é a conta. Ex.: "Hora adicional do evento", "Compra de bebidas", "Equipe de garçons". |
| **Valor (R$)** | Valor da conta. Precisa ser maior que zero. |
| **Vencimento** | Data em que a conta deve ser paga ou recebida. Já vem com a data de hoje. |
| **Categoria** | Categoria do tipo da conta (receita ou despesa). Pode ficar **Sem categoria**. |
| **Forma de pagamento** | Pix, Boleto, Cartão de crédito, Cartão de débito, Transferência, Dinheiro, Cheque ou Outro. |
| **Evento** | Evento a que a conta pertence, ou **Nenhum (conta da empresa)**. Nas contas a receber, a conta fica no nome do cliente do evento. A lista mostra eventos que não foram recusados, do último ano em diante. |
| **Pagador** (a receber) | Preencha só se quem paga não for o cliente do evento. |
| **Fornecedor** (a pagar) | Nome do fornecedor ou profissional. |
| **Documento** | Número da NF, do boleto ou do recibo. |
| **Observações** | Qualquer detalhe útil. |
| **Já foi recebida / Já foi paga** | Aparece só ao criar. Ligado, a conta já nasce quitada, com o valor total como valor pago. |

## Editar ou excluir uma conta

1. Na lista de contas, clique em **Editar** na linha da conta.
2. Altere o que precisar e clique em **Salvar**.
3. Para apagar a conta de vez, use o botão **Excluir** no topo do painel e confirme.

Prefira **Cancelar** em vez de excluir quando quiser manter o histórico: a conta cancelada sai dos totais, mas
continua registrada. Veja [Dar baixa, cancelar e reabrir uma conta](03-dar-baixa-cancelar-e-reabrir-conta.md).

## O que acontece depois

- A conta aparece na lista com a situação **Em aberto** e entra nos totais da [Visão geral](01-visao-geral-do-financeiro.md).
- Quando o vencimento passar sem pagamento, a situação muda sozinha para **Vencida**.
- Contas ligadas a um evento aparecem também na aba **Finanças** dele.

## Perguntas frequentes

### Posso mudar o tipo de uma conta de "a receber" para "a pagar"?
Não. Exclua a conta e lance de novo no tipo certo.

### Escolhi uma categoria e apareceu um erro. Por quê?
A categoria precisa ser do mesmo tipo da conta: categorias de receita só valem para contas a receber, e de despesa
só para contas a pagar.

### Como registro uma compra do estoque como conta a pagar?
Ao registrar a entrada no estoque, use a opção de lançar no financeiro. Veja
[Lançar compra no financeiro](../12-estoque/07-lancar-compra-no-financeiro.md).

### Lancei uma conta já paga com valor diferente. Como ajusto?
Clique em **Reabrir** para desfazer a baixa e registre o pagamento de novo com o valor correto.

## Artigos relacionados
- [Dar baixa, cancelar e reabrir uma conta](03-dar-baixa-cancelar-e-reabrir-conta.md)
- [Plano de pagamento do evento](04-plano-de-pagamento-do-evento.md)
- [Categorias financeiras](06-categorias-financeiras.md)
- [Filtrar e exportar contas](07-filtrar-e-exportar-contas.md)

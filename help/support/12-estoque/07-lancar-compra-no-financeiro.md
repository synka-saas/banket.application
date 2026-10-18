---
title: Lançar compra no financeiro
description: Como registrar a compra no estoque e, no mesmo passo, criar a conta a pagar no financeiro.
category: Estoque
order: 7
updatedAt: 2026-10-18
tags: [estoque, financeiro, compra, contas a pagar]
---

# Lançar compra no financeiro

Ao registrar uma compra no estoque, você pode criar a conta a pagar no financeiro no mesmo formulário. O mesmo vale para
a devolução ao fornecedor, que gera uma conta a receber. Assim você não digita a mesma informação duas vezes.

> **Disponível em:** planos Profissional, Prime e Master · **Quem pode usar:** Proprietário e Administrador

## Quais motivos geram conta

| Motivo | Conta criada |
|---|---|
| **Compra / nota fiscal de fornecedor** | Conta a pagar |
| **Devolução ao fornecedor** | Conta a receber |

Os demais motivos não geram conta.

## Passo a passo

1. Em **Estoque**, clique em **Movimentar**.
2. Escolha o **Item**, o tipo **Entrada** e o motivo **Compra / nota fiscal de fornecedor** (ou o tipo **Saída** e o
   motivo **Devolução ao fornecedor**).
3. Preencha a **Quantidade**, o **Fornecedor**, a **Nota fiscal / documento** e, na compra, o **Custo unitário (R$)**.
4. Ligue **Lançar conta a pagar no financeiro** (ou **Lançar conta a receber no financeiro**).
5. Preencha os dados da conta:
   - **Valor da conta (R$)** (obrigatório): já vem sugerido como quantidade × custo unitário. Você pode alterar;
   - **Vencimento** (obrigatório);
   - **Forma de pagamento**;
   - **Categoria** (só aparecem as categorias do tipo da conta);
   - **Já foi pago** (ou **Já foi recebido**): marque se a conta já foi quitada. O campo de data passa a se chamar
     **Data do pagamento** (ou **Data do recebimento**).
6. Clique em **Registrar**.

A confirmação avisa que a movimentação foi registrada e a conta foi lançada.

## Como a conta é criada

- **Descrição**: "Compra: nome do item (quantidade unidade) · NF número", ou "Devolução ao fornecedor: …".
- **Fornecedor** e **documento**: os mesmos da movimentação.
- **Evento**: o da movimentação, se houver.
- Se marcou **Já foi pago**, a conta já nasce paga na data informada, com o valor informado.

A conta aparece em **Financeiro › Contas a pagar** (ou **a receber**) e pode ser editada lá. No histórico do estoque, a
movimentação recebe a etiqueta **No financeiro**.

## Perguntas frequentes

### Não vejo a opção de lançar no financeiro. Por quê?
Ela aparece só para Proprietário e Administrador, e só nos motivos de compra e de devolução ao fornecedor.

### Esqueci de lançar a conta na hora da compra. E agora?
Lance a conta direto no Financeiro. A movimentação já registrada não é alterada.

### Se eu excluir a conta no financeiro, a movimentação some?
Não. A movimentação continua no estoque; só a conta é apagada.

## Artigos relacionados
- [Registrar movimentação](02-registrar-movimentacao.md)
- [Motivos de movimentação](03-motivos-de-movimentacao.md)
- [Lançar conta a receber ou a pagar](../11-financeiro/02-lancar-conta-a-receber-ou-a-pagar.md)
- [Categorias financeiras](../11-financeiro/06-categorias-financeiras.md)

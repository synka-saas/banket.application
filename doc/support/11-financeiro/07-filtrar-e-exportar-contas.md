---
title: Filtrar e exportar contas
description: Como usar os filtros de situação, vencimento, categoria e busca nas listas de contas e exportar em CSV.
category: Financeiro
order: 7
updatedAt: 2026-10-18
tags: [financeiro, filtros, exportar, csv, excel, contas]
---

# Filtrar e exportar contas

As listas **Contas a receber** e **Contas a pagar** mostram as contas com totais do recorte, filtros, ordenação e
exportação em CSV para abrir no Excel ou em outra planilha.

> **Disponível em:** planos Profissional, Prime e Master · **Quem pode usar:** Proprietário e Administrador

## Como acessar

1. No menu lateral, clique em **Financeiro**.
2. No submenu, clique em **Contas a receber** ou **Contas a pagar**.

## Os totais do topo

Os quatro cards consideram apenas as contas do filtro atual:

| Card | O que mostra |
|---|---|
| **Contas no filtro** | Quantidade de contas e a soma dos valores (sem as canceladas). |
| **Em aberto** | Soma das contas ainda não pagas. |
| **Vencidas** | Soma das contas em aberto com vencimento passado. Clique para filtrar só as vencidas. |
| **Recebido** / **Pago** | Soma do que já foi baixado no filtro, pelo valor efetivamente pago. |

## Filtros disponíveis

- **Busca:** procura na descrição, no cliente, no fornecedor, no documento e no título do evento.
- **Situação:** **Em aberto e vencidas** (padrão ao abrir a página), **Em aberto (a vencer)**, **Vencidas**,
  **Pagas / recebidas**, **Canceladas** ou **Todas**.
- **Vencimento:** **Qualquer vencimento**, **Vence neste mês**, **Venceu no mês passado**, **Vence no próximo mês**,
  **Próximos 30 dias** ou **Neste ano**.
- **Categoria:** as categorias do tipo da lista.

Os filtros se aplicam na hora, sem botão de confirmar. Quando nenhuma conta atende ao filtro, aparece o botão
**Ver todas**.

### Ver as contas de um evento

Na coluna **Conta**, o nome do evento é um link para a aba **Finanças** dele, onde ficam reunidas só as contas daquele
evento. Veja [Finanças do evento](05-financas-do-evento.md).

## Ordenar

Clique no título das colunas **Conta**, **Vencimento** ou **Valor** para ordenar. Sem ordenação escolhida, a lista
segue o vencimento, do mais antigo para o mais novo.

## Exportar em CSV

1. Aplique os filtros que quiser.
2. Clique em **Exportar CSV**.

O arquivo baixado (por exemplo, `contas-a-receber-2026-10-18.csv`) traz todas as contas do filtro atual, não só as da
página. Ele usa ponto e vírgula como separador e abre direto no Excel em português. As colunas são: Descrição,
Categoria, Evento, Cliente / pagador, Fornecedor, Parcela, Vencimento, Valor, Situação, Pago em, Valor pago, Forma de
pagamento, Documento, Origem (Manual, Plano de pagamento ou Estoque) e Observações.

## Perguntas frequentes

### Por que não vejo as contas pagas na lista?
Ao abrir a página, o filtro de situação mostra só as contas **Em aberto e vencidas**. Escolha **Pagas / recebidas**
ou **Todas**.

### A exportação respeita a busca e os filtros?
Sim. O CSV traz exatamente as contas que atendem aos filtros e à busca do momento.

### O que significam as etiquetas Plano e Estoque?
**Plano** indica uma parcela gerada pelo plano de pagamento de um evento. **Estoque** indica uma conta criada a partir
de uma movimentação do estoque.

## Artigos relacionados
- [Visão geral do financeiro](01-visao-geral-do-financeiro.md)
- [Categorias financeiras](06-categorias-financeiras.md)
- [Dar baixa, cancelar e reabrir uma conta](03-dar-baixa-cancelar-e-reabrir-conta.md)
- [Finanças do evento](05-financas-do-evento.md)

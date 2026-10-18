---
title: Lista de compras do evento
description: Como o Banket calcula a quantidade de cada item a comprar, como ajustar, marcar o que foi comprado e exportar a lista.
category: Orçamento e proposta
order: 12
updatedAt: 2026-10-18
tags: [orcamento, lista-de-compras, porcao, estoque]
---

# Lista de compras do evento

A lista de compras mostra quanto comprar de cada item do orçamento, a partir da porção por pessoa e do número de
convidados. É de uso interno: não entra na proposta.

> **Disponível em:** planos Essencial, Profissional, Prime e Master · **Quem pode usar:** todos os usuários

## Antes de começar

Cadastre a **Porção por pessoa** (quantidade + unidade: g, kg, ml, l ou un) de cada item em **Cardápios › Itens do
cardápio**. Sem a porção, o Banket não consegue calcular a quantidade do item.

## Abrir a lista

1. Abra o evento e clique na aba **Orçamento**.
2. Clique na sub-aba **Lista de compras**.

O topo mostra para quantos convidados a lista foi calculada, quantos itens ela tem, quantos já foram comprados e quantos
estão em estoque.

## Como a quantidade é calculada

| Origem | Quantidade calculada |
|---|---|
| Item marcado num cardápio | Porção por pessoa × convidados |
| Bebida cobrada por pessoa | Porção por pessoa × convidados |
| Bebida cobrada por unidade | A quantidade do orçamento |

- A lista usa **todos os convidados**, inclusive crianças (diferente do preço, que considera meia e isentas).
- O mesmo item em dois cardápios aparece uma vez, com as quantidades somadas.
- Item desmarcado ou removido do orçamento sai da lista.
- Quantidades em g ou ml a partir de 1.000 também aparecem convertidas em kg ou l.

## Usar a lista

1. **Ajustar a quantidade:** digite na coluna **Quantidade**. O campo fica destacado como ajuste manual. Para voltar ao
   calculado, apague o valor ou clique no ícone de voltar da linha.
2. **Marcar como comprado:** marque a caixa no início da linha.
3. **Observação:** anote marca, fornecedor ou outro detalhe na coluna **Observação**.
4. **Linha avulsa:** clique em **Adicionar linha avulsa** para itens que não estão no orçamento (gelo, descartáveis…).
   Informe nome, quantidade e unidade. Linhas avulsas podem ser removidas no **x**.

Tudo salva sozinho.

## Itens sem porção

Se algum item não tem porção cadastrada, aparece o aviso "N itens sem porção cadastrada". Você pode digitar a quantidade
na lista ou cadastrar a porção em **Cardápios › Itens** para o cálculo ficar automático.

## Coluna Estoque

Nos planos com o módulo **Estoque** (Profissional, Prime e Master), a coluna mostra se o saldo atual cobre a linha:
**Em estoque**, **Faltam X**, **Sem estoque** ou o saldo, quando a unidade não pode ser convertida. Veja
[Estoque na lista de compras](../12-estoque/06-estoque-na-lista-de-compras.md).

## Exportar

Na barra do rodapé:

- **Exportar CSV**: planilha para abrir no Excel.
- **Exportar PDF**: lista simples para imprimir ou mandar ao comprador. O Banket salva o que estiver pendente antes de
  gerar.

## Perguntas frequentes

### Não consigo editar a lista. Por quê?
Você está numa versão congelada (o rodapé mostra **Versão congelada · somente leitura**). Depois de enviar a proposta, o
trabalho continua na versão atual: clique em **Voltar à atual** no **Histórico de versões**.

### Mudei o número de convidados. A lista acompanha?
Sim, na versão em edição. Os ajustes manuais, as marcações de comprado e as observações são mantidos.

### A lista de compras dá baixa no estoque?
Não. Ela só compara com o saldo atual. Para registrar o consumo, faça a movimentação de saída no Estoque.

## Artigos relacionados
- [Cadastrar itens](../07-cardapios/02-cadastrar-itens.md)
- [Estoque na lista de compras](../12-estoque/06-estoque-na-lista-de-compras.md)
- [Registrar movimentação](../12-estoque/02-registrar-movimentacao.md)
- [Adicionar cardápios](02-adicionar-cardapios.md)

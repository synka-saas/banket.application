---
title: Assistente de Orçamentos IA
description: Como ver a margem projetada do cardápio e usar a IA para sugerir trocas de maior margem e aproveitar o estoque.
category: Assistentes de IA
order: 2
updatedAt: 2026-10-18
tags: [ia, orcamento, margem, estoque, cardapio]
---

# Assistente de Orçamentos IA

O Assistente de Orçamentos IA mostra quanto o cardápio do evento custa em insumos e qual a margem projetada. A
inteligência artificial sugere trocas de itens que reduzem o custo e pratos que aproveitam insumos parados ou perto do
vencimento no estoque. Você aplica a sugestão no orçamento com um clique.

> **Disponível em:** planos Profissional, Prime e Master · **Quem pode usar:** todos os usuários

## Antes de começar

- O evento precisa ter orçamento com pelo menos um item marcado no cardápio.
- Cadastre o **Custo unitário / porção (R$)** de cada item em **Cardápios › Itens do cardápio**. Sem custo, a margem
  não pode ser calculada.
- Para as sugestões de giro de estoque, mantenha o **Estoque** atualizado, com a validade dos itens.

## Passo a passo

1. Abra o evento e clique na aba **Orçamento**.
2. Clique na sub-aba **Assistente de Orçamentos IA**.
3. Confira os indicadores de margem no topo (calculados pelo Banket, sem IA).
4. No card **Assistente de Orçamentos IA**, clique em **Gerar sugestões**. Para refazer depois, clique em
   **Gerar de novo**.
5. Para aceitar uma sugestão, clique em **Aplicar troca** ou **Incluir no cardápio** e confirme.

## Entenda a margem

| Indicador | Como é calculado |
|---|---|
| **Receita de alimentos e bebidas** | Total de alimentos + total de bebidas do orçamento. |
| **Custo dos insumos** | Custo por porção de cada item marcado × convidados. Bebida por unidade: custo × quantidade. Também mostra o custo por convidado. |
| **Margem projetada** | (Receita − custo) ÷ receita, em %, e o valor em reais. |

- Staff, locação e extras ficam fora desta conta: são só os insumos de alimentos e bebidas.
- Sem nenhum custo cadastrado, a margem aparece como **—** e a dica "cadastre o custo dos itens".
- Itens sem custo aparecem num aviso abaixo de **Custo por item**. A margem fica maior do que a real até você cadastrar
  esses custos.
- A cor da margem ajuda a ler: abaixo de 30% indica margem baixa; de 30% a 50%, média; acima de 50%, boa.

O card **Custo por item** lista cada item com custo por porção, quantidade, custo no evento e a participação no custo
total. A mesma margem aparece, resumida, no **Resumo do orçamento** da sub-aba **Itens e valores**.

## Estoque para girar

A coluna da direita lista os insumos do estoque que pedem atenção: os que **vencem em até 15 dias** (ou já venceram) e
os **parados há 45 dias ou mais** sem saída. Clique em **Abrir o estoque** para ver o estoque completo.

## Entenda as sugestões da IA

- **Substituições de maior margem**: troca de um item do cardápio por outro da mesma seção do seu catálogo, com custo
  menor. Cada sugestão mostra o impacto (ex.: "economia de R$ 320,00 no evento"), a justificativa e a equivalência
  gastronômica. Só aparecem trocas entre itens com custo cadastrado e que reduzem o custo.
- **Giro de estoque**: item do catálogo para incluir no cardápio que aproveita um insumo com alerta no estoque, com o
  custo adicional estimado.
- **Alertas**: observações gerais da IA sobre o cardápio.

Ao aplicar uma sugestão:

- **Aplicar troca**: o item sai e o novo entra no mesmo lugar do cardápio.
- **Incluir no cardápio**: o item entra na seção do orçamento ligada à mesma seção do catálogo.
- O orçamento é recalculado e a mudança fica registrada na linha do tempo do evento.

## Regras importantes

- **A IA não muda nada sozinha.** As sugestões só entram no orçamento quando você clica para aplicar.
- Sugestões só podem ser aplicadas na versão em edição. Numa versão congelada, os botões não aparecem.
- Se a análise foi feita em outra versão, a tela avisa: "Esta análise foi feita na versão NN."
- O rodapé da análise mostra quem gerou, quando, o link **contexto enviado (.md)** com o que foi enviado à IA e as
  análises anteriores.
- Confira se a troca faz sentido para o seu cliente (restrições, preferências) antes de aplicar.

## Limites do plano

As análises somam com as do [Assistente de Negociação IA](01-assistente-de-negociacao.md):

| Plano | Análises de IA por mês |
|---|---|
| Profissional | 30 |
| Prime | 100 |
| Master | sem limite |

Há também um limite de 20 análises a cada 10 minutos por empresa.

## Perguntas frequentes

### Apareceu "Monte o cardápio do orçamento antes de pedir sugestões." O que fazer?
Adicione um cardápio e marque pelo menos um item na sub-aba **Itens e valores**.

### Por que não vieram substituições?
Sem custos cadastrados não dá para comparar a margem entre itens. Também pode não existir, na mesma seção do catálogo,
um item mais barato e equivalente.

### Por que o giro de estoque veio vazio?
Não há insumos vencendo em até 15 dias nem parados há 45 dias ou mais, ou nenhum item do catálogo combina com eles.

### Apliquei uma troca por engano. Como desfaço?
Na sub-aba **Itens e valores**, desmarque ou remova o item novo e inclua de volta o anterior com **Adicionar item**.

## Artigos relacionados
- [Assistente de Negociação IA](01-assistente-de-negociacao.md)
- [Como o valor é calculado](../04-orcamento/13-como-o-valor-e-calculado.md)
- [Adicionar cardápios](../04-orcamento/02-adicionar-cardapios.md)
- [Cadastrar itens](../07-cardapios/02-cadastrar-itens.md)
- [Cadastrar item de estoque](../12-estoque/01-cadastrar-item-de-estoque.md)

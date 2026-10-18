---
title: Como o valor do orçamento é calculado
description: Entenda pagantes, meia e isentas, o cálculo de cada parte do orçamento, os ajustes manuais e o valor final da proposta.
category: Orçamento e proposta
order: 13
updatedAt: 2026-10-18
tags: [orcamento, calculo, pagantes, valor-total]
---

# Como o valor do orçamento é calculado

O Banket recalcula o orçamento a cada alteração. Este artigo explica de onde vem cada número e como seus ajustes
manuais entram na conta.

> **Disponível em:** planos Essencial, Profissional, Prime e Master · **Quem pode usar:** todos os usuários

## Convidados e pagantes

No topo da sub-aba **Itens e valores** ficam três campos:

- **Convidados**: total de pessoas no evento.
- **Crianças meia (até N anos)**: crianças que pagam metade.
- **Crianças isentas (até N anos)**: crianças que não pagam.

As idades vêm de **Configurações › Empresa** (padrão: isentas até 5 anos, meia até 11). Ao lado aparece o número de
**Pagantes**:

> **Pagantes = convidados − isentas − meia + meia × 0,5**

Exemplo: 120 convidados, 10 crianças meia e 6 isentas → 120 − 6 − 10 + 5 = **109 pagantes**.

## Cálculo de cada parte

| Parte | Como é calculada |
|---|---|
| **Cardápio** | Preço por pessoa = preço base da opção + preço de cada seção. Subtotal = preço por pessoa × pagantes. |
| **Seção do cardápio** | Preço manual, senão o preço da seção no catálogo, senão a soma dos itens marcados. |
| **Bebida por pessoa** | Valor unitário × pagantes. |
| **Bebida por unidade** | Valor unitário × quantidade. |
| **Staff** | Quantidade (pela regra da função e o total de convidados) × (cachê/diária + auxílio). |
| **Locação** | Espaço próprio: faixa de locação dos convidados. Espaço de terceiro: valor de referência. Só conta com **Incluir locação do espaço** ligado. |
| **Extras** | Quantidade × valor unitário. |

**Total calculado = alimentos + bebidas + staff + locação + extras.** Os valores são arredondados em centavos.

Repare: cardápios e bebidas por pessoa usam os **pagantes**; o staff usa o total de **convidados**.

## Ajustes manuais

Quase todo valor pode ser ajustado. A regra é sempre a mesma: **o valor digitado vale no lugar do calculado.**

- O campo vazio mostra o valor calculado em cinza.
- Ao digitar, o campo fica destacado como ajuste manual.
- Para voltar ao calculado, apague o valor ou clique no ícone de voltar ao lado do campo.

Ajustes manuais não mudam com o recálculo: se você fixar o subtotal de um cardápio e depois mudar os convidados, o
subtotal continua o mesmo.

## Resumo do orçamento

No fim da sub-aba **Itens e valores**, o card **Resumo do orçamento** mostra:

- Alimentos, Bebidas, Staff, Locação, Extras e o **Total calculado**.
- **Custo dos insumos (estimado)** e **Margem de alimentos e bebidas**: estimativa interna a partir do custo por porção
  dos itens (veja [Assistente de Orçamentos IA](../05-assistentes-de-ia/02-assistente-de-orcamentos.md)). Se algum
  item não tem custo, um aviso indica que a margem fica maior do que a real.
- **Valor final da proposta**: deixe vazio para usar o total calculado ou digite o valor fechado com o cliente (um
  arredondamento ou desconto, por exemplo). Com valor manual, o topo mostra também "calculado: R$ …".
- **Mostrar o valor total na proposta**: liga ou desliga o resumo de valores no PDF.
- **Observações internas**: anotações da equipe. Não aparecem na proposta.

O valor no topo do orçamento é o valor final: o manual, quando houver, ou o calculado.

## Perguntas frequentes

### Por que o subtotal do cardápio tem número quebrado de pessoas?
Porque crianças meia contam como meia pessoa nos pagantes.

### O valor final manual é dividido entre as partes?
Não. As partes continuam com os valores calculados; só o valor total da proposta muda.

### Mudei o preço no catálogo. Por que o orçamento não mudou?
O orçamento guarda o preço do catálogo no momento em que cada item foi incluído, para não mudar uma proposta sem você
perceber.

### O valor de uma versão enviada pode mudar?
Não. Versões congeladas guardam os valores propostos. Veja [Versões do orçamento](08-versoes-do-orcamento.md).

## Artigos relacionados
- [Adicionar cardápios](02-adicionar-cardapios.md)
- [Staff no orçamento](04-staff-no-orcamento.md)
- [Locação e extras](05-locacao-e-extras.md)
- [Parâmetros comerciais](../19-configuracoes/02-parametros-comerciais.md)
- [Assistente de Orçamentos IA](../05-assistentes-de-ia/02-assistente-de-orcamentos.md)

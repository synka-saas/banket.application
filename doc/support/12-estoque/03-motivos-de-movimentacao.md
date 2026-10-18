---
title: Motivos de movimentação
description: Lista de todos os motivos de entrada, saída e contagem do estoque e os campos que cada um exige.
category: Estoque
order: 3
updatedAt: 2026-10-18
tags: [estoque, motivos, entrada, saida, inventario]
---

# Motivos de movimentação

Cada entrada ou saída do estoque tem um motivo. O motivo define quais informações o sistema pede (fornecedor, nota,
evento, espaço, justificativa ou custo) e deixa o histórico claro para toda a equipe.

> **Disponível em:** planos Profissional, Prime e Master · **Quem pode usar:** todos os usuários

## Motivos de entrada

| Motivo | Quando usar | O que é pedido |
|---|---|---|
| **Compra / nota fiscal de fornecedor** | Aquisição de insumos. | Fornecedor e nota fiscal obrigatórios; custo unitário opcional (recalcula o custo médio). |
| **Devolução / retorno de evento** | Sobras não consumidas ou itens lacrados que voltam do evento. | Evento obrigatório. |
| **Ajuste de inventário (sobra)** | Contagem física acima do saldo do sistema. | Justificativa obrigatória. |
| **Produção interna / pré-preparo** | Subitens feitos na cozinha (bases, massas, caldas). | Custo unitário opcional. |
| **Transferência entre espaços (entrada)** | Carga recebida de outro salão, cozinha ou depósito. | Espaço obrigatório. |
| **Bonificação / amostra de fornecedor** | Recebimento gratuito. Entra sem mudar o custo médio. | Fornecedor opcional. |

## Motivos de saída

| Motivo | Quando usar | O que é pedido |
|---|---|---|
| **Consumo em evento** | Baixa para a execução de um evento (custo real × orçado). | Evento obrigatório. |
| **Degustação comercial** | Prova de cardápio com clientes em negociação. | Evento obrigatório. |
| **Perda / vencimento / descarte** | Perecíveis estragados, vencidos, avariados ou queimados. | Justificativa obrigatória. |
| **Quebra / avaria** | Vidros, garrafas e louças quebrados no serviço, transporte ou montagem. | Justificativa obrigatória; evento opcional. |
| **Consumo interno / alimentação da equipe** | Refeições do staff, fora do cardápio vendido. | Evento opcional. |
| **Ajuste de inventário (falta)** | Contagem física abaixo do saldo do sistema. | Justificativa obrigatória. |
| **Transferência entre espaços (saída)** | Envio da base central para um espaço próprio ou parceiro. | Espaço obrigatório; evento opcional. |
| **Devolução ao fornecedor** | Produtos avariados, fora da especificação ou com validade inadequada. | Fornecedor e justificativa obrigatórios; nota fiscal opcional. |

## Contagem

| Motivo | Quando usar | O que é pedido |
|---|---|---|
| **Contagem física (inventário)** | Você contou o item e quer acertar o saldo. | Só a **Quantidade contada**. O sistema registra a diferença. |

Ao escolher o tipo **Contagem**, o motivo é sempre este e o campo de motivo não aparece.

## Ajuste de inventário ou contagem: qual usar?

- Use **Contagem** quando você sabe o saldo real e quer que o sistema calcule a diferença.
- Use **Ajuste de inventário (sobra)** ou **(falta)** quando você sabe a diferença (ex.: "faltaram 2 kg") e quer
  registrar o motivo com justificativa.

## Por que ligar a saída ao evento

Saídas de **Consumo em evento** e **Degustação comercial** ficam ligadas ao evento e guardam o custo médio do momento.
Esse valor aparece como custo do estoque consumido na aba Finanças do evento, para comparar o custo real com o orçado.

## Perguntas frequentes

### O que acontece com os campos que o motivo não usa?
São ignorados. Se você preencher um evento e depois trocar para um motivo que não usa evento, o evento não é gravado.

### Quais motivos geram conta no financeiro?
**Compra / nota fiscal de fornecedor** (conta a pagar) e **Devolução ao fornecedor** (conta a receber). Veja
[Lançar compra no financeiro](07-lancar-compra-no-financeiro.md).

### Posso criar motivos novos?
Não. A lista de motivos é fixa. Use o campo de observação para dar mais detalhes.

## Artigos relacionados
- [Registrar movimentação](02-registrar-movimentacao.md)
- [Histórico de movimentações](04-historico-de-movimentacoes.md)
- [Lançar compra no financeiro](07-lancar-compra-no-financeiro.md)
- [Finanças do evento](../11-financeiro/05-financas-do-evento.md)

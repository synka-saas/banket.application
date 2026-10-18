---
title: Staff no orçamento
description: Como o Banket dimensiona a equipe do evento no orçamento e como ajustar quantidade e valor de cada função.
category: Orçamento e proposta
order: 4
updatedAt: 2026-10-18
tags: [orcamento, staff, equipe]
---

# Staff no orçamento

A seção **Staff** calcula quantos profissionais de cada função o evento precisa e quanto isso custa, com base nas regras
cadastradas em **Staff › Serviços e custos**.

> **Disponível em:** planos Essencial, Profissional, Prime e Master · **Quem pode usar:** todos os usuários

## Antes de começar

Cadastre as funções (garçom, copeira, maître…) com cachê, auxílio e regra de dimensionamento em
**Staff › Serviços e custos** (veja [Serviços e funções](../13-staff/01-servicos-e-funcoes.md)). As funções marcadas com
**Incluir automaticamente em novos orçamentos** já entram quando o orçamento é criado.

## Passo a passo

1. Abra o evento, clique na aba **Orçamento** e vá até a seção **Staff**.
2. Para incluir outra função, clique em **Adicionar função** e escolha na lista (cada opção mostra a regra).
3. Se precisar, ajuste a **Qtd.** ou o **Valor unit.** da linha.
4. Para tirar uma função, clique no **x** da linha. O aviso traz **Desfazer**.

## Como a quantidade é calculada

A coluna **Regra** mostra a regra da função e o número de convidados considerado:

| Regra | Quantidade |
|---|---|
| **N profissionais por evento** | Sempre N, qualquer que seja o número de convidados. |
| **1 a cada X convidados** | Convidados ÷ X, arredondado para cima, respeitando o mínimo da função. |
| **N fixo(s)** | O mínimo cadastrado. |

Exemplo: 1 garçom a cada 15 convidados, com mínimo de 2. Para 100 convidados: 100 ÷ 15 = 6,67 → **7 garçons**.

O **Valor unit.** é o cachê/diária + o auxílio da função. O **Subtotal** é quantidade × valor unitário.

O staff usa o número total de **convidados** (não os pagantes), porque crianças também precisam ser atendidas.

## Ajustes manuais

- Digite na **Qtd.** para fixar outra quantidade. Apague o campo para voltar ao calculado.
- Digite no **Valor unit.** para usar outro valor. Apague ou clique no ícone de voltar para retornar ao calculado.

## O que acontece depois

- O bloco **Dimensionamento da equipe** em **Informações complementares** se preenche sozinho com uma linha por função
  (ex.: "Garçom: 7 profissionais").
- O total de staff entra no resumo do orçamento e na proposta.

## Perguntas frequentes

### Mudei o cachê da função em Staff. O orçamento atualiza?
A regra é copiada para o orçamento quando a função é incluída. Para usar o valor novo, remova a função e adicione de
novo, ou ajuste o **Valor unit.** manualmente.

### A lista de funções está vazia. O que fazer?
Aparece "Nenhuma função cadastrada em Staff › Serviços e custos." Cadastre as funções lá e volte ao orçamento.

### O cliente vê o valor de cada profissional?
Sim. A parte **Staff** da proposta lista cada função com a quantidade de profissionais e o valor unitário (ex.:
"Garçom – 7 profissionais – R$ 180,00"). Se o valor total estiver visível, o total de staff também aparece no resumo
final. Funções com quantidade zero não aparecem.

## Artigos relacionados
- [Serviços e funções](../13-staff/01-servicos-e-funcoes.md)
- [Informações complementares e condições gerais](06-informacoes-complementares-e-condicoes-gerais.md)
- [Como o valor é calculado](13-como-o-valor-e-calculado.md)

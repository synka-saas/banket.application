---
title: Filtrar e exportar eventos
description: Como pesquisar, filtrar os eventos do Painel de Propostas e baixar a lista em planilha (CSV).
category: Propostas e eventos
order: 5
updatedAt: 2026-10-18
tags: [propostas, filtros, exportar, csv, planilha]
---

# Filtrar e exportar eventos

No Painel de Propostas você encontra rapidamente um evento pela pesquisa e pelos filtros, e pode baixar a lista em
planilha para analisar no Excel ou no Google Planilhas.

> **Disponível em:** planos Essencial, Profissional, Prime e Master · **Quem pode usar:** todos os usuários

## Pesquisar

1. No menu lateral, clique em **Propostas**.
2. Digite no campo **Pesquisar** e confirme.

   ![Pesquisa por Maria na visão Lista](01-filtrar-e-exportar-eventos.webp)

A pesquisa procura no título do evento, no nome do cliente, no nome do responsável e no nome do local.

## Filtrar

1. Clique em **Filtros**.
2. Preencha o que quiser:
   - **Data de** e **Até**: período da data do evento.
   - **Tipo de evento**: Corporativo ou Social.
   - **Formato de serviço**.
   - **Etapa**: no Kanban, mostra só a coluna escolhida.

   ![Painel de filtros aberto com período e tipo de evento preenchidos](02-filtrar-e-exportar-eventos.webp)

3. Clique em **Aplicar**.

   ![Filtros aplicados na visão Lista: o botão mostra Filtros (2) e as etiquetas de cada filtro com Limpar tudo](03-filtrar-e-exportar-eventos.webp)

O botão passa a mostrar quantos filtros estão ativos, por exemplo **Filtros (2)**. Logo abaixo da barra aparecem
etiquetas com cada filtro. Clique no **×** de uma etiqueta para tirar só aquele filtro, ou em **Limpar tudo** para tirar
todos. O botão **Limpar**, dentro do painel de filtros, faz o mesmo.

Os filtros valem tanto no **Kanban** quanto na **Lista**, e continuam ao trocar de visão.

### Filtro de datas e intervalo de trabalho
No Kanban, as datas do filtro substituem o intervalo de trabalho enquanto estiverem ativas. Assim você consegue ver, por
exemplo, os eventos de um mês do ano que vem. Clique em **Voltar ao intervalo de trabalho** para retornar.

![No Kanban, as datas do filtro substituem o intervalo de trabalho; o link volta ao intervalo](04-filtrar-e-exportar-eventos.webp)

## Exportar para planilha

1. Aplique a pesquisa e os filtros que quiser (opcional).
2. Clique em **Exportar CSV**.

   ![Botão Exportar CSV na barra do Painel de Propostas](05-filtrar-e-exportar-eventos.webp)

O arquivo `eventos-AAAA-MM-DD.csv` é baixado com os eventos que atendem aos filtros e à pesquisa, em ordem de data. As
colunas são: Evento, Cliente, Etapa, Data, Horário, Convidados, Tipo, Ocasião, Formato de serviço, Local, Verba,
Orçamento, Responsável, E-mail e WhatsApp.

O arquivo usa ponto e vírgula como separador e acentuação compatível com o Excel em português: basta abrir com dois
cliques.

## Perguntas frequentes

### A exportação respeita o intervalo de trabalho do Kanban?
Não. A exportação considera só a pesquisa e os filtros escolhidos. Sem filtros, ela traz todos os eventos da empresa.

### Como vejo apenas os eventos perdidos?
Abra **Filtros**, escolha a etapa de recusado em **Etapa** e clique em **Aplicar**. Na visão Lista você também pode
ordenar pela coluna **Etapa**.

### O valor exportado é o da proposta enviada?
A coluna **Orçamento** traz o total da versão atual do orçamento. A coluna **Verba** traz a estimativa informada pelo
cliente.

## Artigos relacionados
- [Usar o Painel de Propostas](01-painel-de-propostas.md)
- [Mover um evento entre etapas](04-mover-evento-entre-etapas.md)

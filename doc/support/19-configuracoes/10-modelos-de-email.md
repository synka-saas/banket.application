---
title: Modelos de e-mail
description: Como criar modelos de assunto e mensagem com variáveis para enviar propostas e responder clientes, e como definir o modelo padrão.
category: Configurações
order: 10
updatedAt: 2026-10-18
tags: [configuracoes, modelos de email, proposta, inbox, variaveis]
---

# Modelos de e-mail

Os modelos de e-mail guardam o assunto e a mensagem que você usa com frequência: o envio da proposta, um lembrete de
validade, um agradecimento depois da degustação. Na hora de enviar, as variáveis (como o nome do cliente) são trocadas
pelos dados do evento.

> **Disponível em:** planos Essencial, Profissional, Prime e Master · **Quem pode usar:** Proprietário e Administrador

Toda empresa já começa com o modelo **Proposta padrão**.

## Criar um modelo

1. No menu lateral, clique em **Configurações** e, no submenu, em **Modelos de e-mail**.
2. Clique em **Novo modelo**.
3. Preencha:
   - **Nome do modelo** (obrigatório), por exemplo "Lembrete de validade";
   - **Assunto** (obrigatório);
   - **Mensagem** (obrigatória).
4. Para inserir uma variável, posicione o cursor no assunto ou na mensagem e clique no chip da variável, abaixo da
   mensagem.
5. Confira o resultado em **Prévia com dados de exemplo**.
6. Se quiser, ligue **Modelo padrão** e deixe **Modelo ativo** ligado.
7. Clique em **Salvar**.

## Variáveis disponíveis

| Variável | É trocada por |
|---|---|
| `{nome_cliente}` | Nome do cliente |
| `{evento}` | Título do evento |
| `{data_evento}` | Data do evento |
| `{empresa}` | Nome da sua empresa |
| `{valor_total}` | Valor total da proposta |
| `{versao}` | Número da versão da proposta |

Exemplo de assunto: `Proposta {versao} – {evento}`.

## Modelo padrão e modelos ativos

- O **padrão** já vem selecionado ao enviar a proposta. Na lista, ele aparece com a marca **Padrão**.
- Para trocar o padrão, clique em **Definir como padrão** na linha de outro modelo ativo.
- O modelo padrão precisa estar ativo. Para desativar o padrão, defina outro como padrão antes.
- Um modelo **inativo** (marca **Inativo**) não aparece para seleção, mas continua guardado.
- O primeiro modelo da empresa é sempre o padrão.

## Onde os modelos são usados

- **Envio da proposta**: o campo **Modelo** traz os modelos ativos, com o padrão já preenchido.
- **Inbox**: ao responder um cliente ou escrever uma mensagem nova no evento, use **Inserir modelo**.

Depois de escolhido, o texto pode ser ajustado livremente antes de enviar. A mudança vale só para aquele e-mail.

## Excluir um modelo

Clique em **Editar**, depois em **Excluir** e confirme. Regras:
- a empresa precisa manter pelo menos um modelo;
- ao excluir o padrão, o próximo modelo ativo vira o padrão.

## Limites do plano

| Plano | Modelos de e-mail ativos |
|---|---|
| Essencial | só o modelo inicial (pode ser editado, mas não é possível criar outros ativos) |
| Profissional | 10 |
| Prime | 20 |
| Master | sem limite |

Contam apenas os modelos ativos: criar um modelo ativo ou reativar um inativo ocupa uma vaga.

## Perguntas frequentes

### A variável apareceu escrita no e-mail, sem trocar pelo dado.
Confira se ela está escrita exatamente como na lista, com as chaves, por exemplo `{nome_cliente}`. Se o dado não
existir no evento (por exemplo, sem data definida), confira o texto antes de enviar.

### Mudar um modelo altera e-mails já enviados?
Não. Os e-mails enviados ficam como foram, no histórico do Inbox.

### Posso usar estes modelos na pesquisa de satisfação?
Não. O e-mail da pesquisa tem um modelo próprio, em **Pesquisas**. Veja
[Configurar questionário](../17-pesquisas/02-configurar-questionario.md).

## Artigos relacionados
- [Enviar proposta por e-mail](../04-orcamento/11-enviar-proposta-por-email.md)
- [Responder mensagem](../06-inbox/02-responder-mensagem.md)
- [Nova mensagem pelo evento](../06-inbox/03-nova-mensagem-pelo-evento.md)

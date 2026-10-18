---
title: Enviar a proposta por e-mail
description: Como enviar a proposta ao cliente com o PDF em anexo, usando um modelo de e-mail, e o que acontece com a versão enviada.
category: Orçamento e proposta
order: 11
updatedAt: 2026-10-18
tags: [orcamento, proposta, email, envio]
---

# Enviar a proposta por e-mail

Você envia a proposta direto do orçamento. O cliente recebe um e-mail com a mensagem que você escreveu e o PDF da
versão em anexo.

> **Disponível em:** planos Essencial, Profissional, Prime e Master · **Quem pode usar:** todos os usuários

## Antes de começar

- Confira a proposta na sub-aba **Pré-visualização**.
- Para não digitar a mensagem toda vez, cadastre modelos em **Configurações › Modelos de e-mail** (veja
  [Modelos de e-mail](../19-configuracoes/10-modelos-de-email.md)).

## Passo a passo

1. Abra o evento, clique na aba **Orçamento** (sub-aba **Itens e valores**).
2. Na barra do rodapé, clique em **Enviar ao cliente**.
3. No painel **Enviar proposta · versão NN**, preencha:
   - **Para**: já vem com o e-mail do responsável do evento ou, se não houver, do cliente. Digite outro e-mail e
     tecle Enter ou vírgula para adicionar. Até 5 destinatários. Clique no **x** de um e-mail para tirá-lo.
   - **Modelo**: escolha o modelo de e-mail. O modelo padrão já vem selecionado. Trocar o modelo preenche assunto e
     mensagem, já com os dados do evento.
   - **Assunto** e **Mensagem**: ajuste à vontade.
4. Confira a **Prévia do e-mail**, que mostra o anexo (PDF da proposta), o assunto e a mensagem.
5. Clique em **Enviar** e confirme. A confirmação mostra a versão, o total e os destinatários.

## Variáveis dos modelos

Nos modelos de e-mail, estas variáveis são trocadas pelos dados do evento:

| Variável | Vira |
|---|---|
| `{nome_cliente}` | Nome do responsável do evento (ou do cliente) |
| `{evento}` | Título do evento |
| `{data_evento}` | Data do evento (ou "data a definir") |
| `{empresa}` | Nome do seu buffet |
| `{valor_total}` | Total da versão |
| `{versao}` | Número da versão (ex.: 02) |

## O que acontece depois

- **A versão enviada fica congelada** exatamente como o cliente recebeu, e o Banket abre a próxima versão para os
  ajustes. Exemplo: você envia a versão 01; ela congela e você passa a editar a versão 02.
- O envio fica registrado na versão ("Enviada para … em …" no **Histórico de versões**) e na linha do tempo do evento.
- O e-mail abre (ou continua) uma conversa sua com o cliente neste evento. As respostas do cliente chegam no **Inbox** e
  na aba **Mensagens** do evento (o Inbox está nos planos Profissional, Prime e Master).
- Se o painel mostrar "Esta versão já foi enviada em…", você está reenviando uma versão já enviada. Reenviar uma versão
  congelada não cria versão nova.

## Perguntas frequentes

### Enviei sem querer duas vezes. O cliente recebe em dobro?
Não. O Banket bloqueia o reenvio da mesma versão para os mesmos destinatários por um minuto ("Esta versão acabou de ser
enviada… Aguarde um minuto para reenviar.").

### Apareceu "E-mail registrado no log do servidor (sem envio real…)". O que significa?
O e-mail não saiu de fato, geralmente porque o destinatário é um endereço de teste (como `@example.com`). O envio fica
anotado na linha do tempo mesmo assim. Confira o endereço e envie de novo.

### Posso enviar uma versão antiga?
Sim. Acesse a versão pelo **Histórico de versões** e clique em **Enviar ao cliente**.

### Posso enviar a proposta pelo WhatsApp?
O envio pelo Banket é por e-mail. Para o WhatsApp, baixe o PDF (**Salvar e baixar PDF**) e envie pelo aplicativo.

## Artigos relacionados
- [Versões do orçamento](08-versoes-do-orcamento.md)
- [Prévia e PDF da proposta](09-previa-e-pdf-da-proposta.md)
- [Modelos de e-mail](../19-configuracoes/10-modelos-de-email.md)
- [Conhecer o Inbox](../06-inbox/01-conhecer-o-inbox.md)

---
title: Faturas, recibos e cartão
description: Como consultar as faturas da assinatura, baixar o PDF, atualizar o cartão de crédito e acompanhar o histórico do plano.
category: Planos e assinatura
order: 7
updatedAt: 2026-10-18
tags: [faturas, recibos, cartao, historico]
---

# Faturas, recibos e cartão

Em **Configurações › Financeiro** você acompanha tudo sobre a cobrança do Banket: a situação do plano, as faturas da
assinatura, o cartão cadastrado e o histórico de mudanças de plano.

> **Disponível em:** todos os planos · **Quem pode usar:** Proprietário e Administrador

## Card Seu plano

Mostra o nome do plano e a situação:

| Situação | O que significa |
|---|---|
| **Gratuito** | Plano Busca, sem cobrança |
| **Em teste** | Teste grátis em andamento, com a data final em **Teste grátis até** |
| **Contratado · em teste** | Você assinou para cobrar no fim do teste; a data aparece em **Primeira cobrança** |
| **Ativa** | Assinatura em dia |
| **Cancelamento agendado** | O acesso termina na data de **Acesso até** |
| **Fatura vencida** | Há uma fatura vencida; pague para não voltar ao plano Busca |
| **Encerrada** | A assinatura terminou |

Com a assinatura ativa, o card também mostra o **Valor**, a **Próxima cobrança** e a **Forma de pagamento** (a bandeira e o
final do cartão, ou "Pix (fatura com 7 dias para pagar)").

## Card Faturas

Lista as cobranças da assinatura com **Data**, **Plano** (e a forma, Pix ou Cartão), **Valor** e **Situação**:

| Situação | O que significa |
|---|---|
| **Paga** | Pagamento confirmado |
| **Em aberto** | Aguardando pagamento, dentro do prazo |
| **Vencida** | Em aberto com o vencimento já passado |
| **Cancelada** | Fatura anulada (por exemplo, numa contratação não concluída) |
| **Não paga** | Fatura que não foi paga e não será mais cobrada |

Ações de cada linha:
- **Pagar com Pix**: abre o QR Code da fatura. Veja [Pagar com Pix](04-pagar-com-pix.md).
- **Pagar**: abre a página de pagamento de uma fatura de cartão em aberto.
- **PDF**: abre o documento da fatura para baixar ou imprimir.

## Atualizar o cartão e ver recibos

Para assinaturas pagas com cartão de crédito:

1. Em **Configurações › Financeiro**, no card **Seu plano**, clique em **Cartão e recibos**.
2. Abre uma página segura de pagamento, onde você troca o cartão e consulta os recibos.
3. Ao terminar, use o link de volta para retornar ao Banket.

Se uma cobrança no cartão for recusada, o card **Seu plano** mostra a fatura em aberto com o botão **Atualizar cartão**,
que abre direto a troca do cartão. Proprietários e administradores também recebem o e-mail "Não conseguimos cobrar a
sua assinatura".

## Card Uso do plano

Mostra cada limite do plano atual e quanto a empresa já usa (por exemplo, "Usuários ativos 3 de 5"), com uma barra de
progresso. Veja [Limites do plano](09-limites-do-plano.md).

## Card Histórico do plano

Registra cada mudança de plano da empresa, com a data, o plano de origem e o de destino e quem fez (o nome da pessoa,
"pagamento", "automático" ou "equipe Banket"). Os motivos que aparecem são, por exemplo: **Início do teste grátis**,
**Troca de plano no teste**, **Assinatura confirmada**, **Mudança para um plano maior**, **Mudança para um plano menor**,
**Fim do teste sem assinatura**, **Fatura não paga** e **Assinatura encerrada**.

## E-mails de cobrança

Proprietários e administradores com e-mail confirmado recebem:

| E-mail | Quando |
|---|---|
| "Assinatura do plano ... confirmada" | Quando o pagamento da contratação é confirmado |
| "Sua fatura do Banket vence em ..." | A cada fatura Pix, com o botão **Pagar com Pix** |
| "Não conseguimos cobrar a sua assinatura" | Quando uma cobrança no cartão é recusada |
| "Cancelamento da assinatura agendado" | Depois de cancelar |
| "Sua empresa voltou ao plano Busca" | Quando uma fatura não é paga no prazo |
| "Sua assinatura foi encerrada" | Quando a assinatura termina após o cancelamento |

## Perguntas frequentes

### A fatura sai com o CPF ou CNPJ da empresa?
Sim. A cobrança usa o CPF ou CNPJ, a razão social e o endereço informados em **Configurações › Empresa**. Mantenha esses
dados atualizados. Veja [Dados da empresa](../19-configuracoes/01-dados-da-empresa.md).

### Não aparece o botão Cartão e recibos.
Ele só aparece em assinaturas pagas com cartão. No Pix, as faturas e os PDFs ficam no card **Faturas**.

### Quem recebe os e-mails de cobrança?
Todos os proprietários e administradores ativos da empresa que já confirmaram o e-mail.

## Artigos relacionados
- [Pagar com Pix](04-pagar-com-pix.md)
- [Contratar a assinatura](03-contratar-assinatura.md)
- [Fim do teste e rebaixamento](08-fim-do-teste-e-rebaixamento.md)
- [Limites do plano](09-limites-do-plano.md)

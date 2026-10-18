---
title: Variáveis e campos extras
description: Lista das variáveis disponíveis nos modelos de documento e como criar campos próprios, preenchidos na hora de gerar.
category: Documentos e contratos
order: 2
updatedAt: 2026-10-18
tags: [documentos, contratos, variaveis, campos]
---

# Variáveis e campos extras

Variáveis são marcações entre chaves, como `{cliente}`, que o Banket troca pelos dados reais ao gerar o documento.
Além das variáveis do sistema, você pode criar as suas: elas viram campos para preencher na hora de gerar.

> **Disponível em:** planos Essencial, Profissional, Prime e Master · **Quem pode usar:** proprietários e administradores (edição dos modelos)

## Como usar

1. Abra o modelo em **Documentos** › **Editar**.
2. Posicione o cursor no **Título do documento** ou no texto do **Conteúdo**.
3. Clique na variável desejada em **Variáveis do sistema**, ou digite-a entre chaves.
4. Confira o resultado na **Prévia**, que usa dados de exemplo.

## Variáveis do sistema

### Empresa

| Variável | O que mostra |
|---|---|
| `{empresa}` | Nome fantasia |
| `{empresa_razao_social}` | Razão social |
| `{empresa_documento}` | CNPJ/CPF da empresa |
| `{empresa_endereco}` | Endereço da empresa |
| `{empresa_email}` | E-mail da empresa |
| `{empresa_telefone}` | Telefone da empresa |
| `{assinante_nome}` | Nome do assinante (Configurações › Empresa) |
| `{assinante_cargo}` | Cargo do assinante |

### Cliente

| Variável | O que mostra |
|---|---|
| `{cliente}` | Nome do cliente |
| `{cliente_documento}` | CPF/CNPJ do cliente |
| `{cliente_email}` | E-mail do cliente |
| `{cliente_telefone}` | Telefone do cliente |
| `{cliente_endereco}` | Endereço do cliente |
| `{responsavel}` | Responsável pelo evento (sem responsável, o nome do cliente) |
| `{responsavel_email}` | E-mail do responsável |
| `{responsavel_whatsapp}` | WhatsApp do responsável |

### Evento

| Variável | O que mostra |
|---|---|
| `{evento}` | Título do evento |
| `{data_evento}` | Data do evento (20/11/2027) |
| `{data_evento_extenso}` | Data por extenso (20 de novembro de 2027) |
| `{hora_inicio}` e `{hora_fim}` | Hora de início e de término |
| `{horario}` | Faixa de horário (19h às 00h) |
| `{convidados}` | Número de convidados |
| `{local}` | Local (espaço) |
| `{endereco_evento}` | Endereço do evento |
| `{tipo_evento}` | Tipo (Corporativo ou Social) |
| `{ocasiao}` | Ocasião |
| `{formato_servico}` | Formato de serviço |

### Orçamento

| Variável | O que mostra |
|---|---|
| `{valor_total}` | Valor total da versão atual do orçamento (R$ 25.400,00) |
| `{valor_total_extenso}` | Valor total por extenso |
| `{versao_orcamento}` | Versão do orçamento |
| `{forma_pagamento}` | Forma de pagamento informada no briefing do evento |
| `{plano_pagamento}` | Parcelas do plano de pagamento cadastrado no financeiro (entrada, parcelas, valores, vencimentos e forma). Sem plano cadastrado, usa a forma de pagamento do briefing |

### Documento

| Variável | O que mostra |
|---|---|
| `{numero_documento}` | Número do documento (2026/0007) |
| `{data_hoje}` | Data da geração |
| `{data_hoje_extenso}` | Data da geração por extenso |

Quando o dado não está preenchido no cadastro (por exemplo, o CPF do cliente), a variável sai em branco. Confira o
evento e o cliente antes de gerar.

## Campos extras

Qualquer variável que não está na lista acima vira um **campo extra**: o Banket pede o valor na hora de gerar o
documento. Exemplo:

```
O pagamento será feito em {numero_parcelas} parcelas, com vencimento todo dia {dia_vencimento}.
```

Ao gerar, aparecem os campos **Numero parcelas** e **Dia vencimento** para preencher. O nome do campo vem da própria
variável, com os sublinhados trocados por espaços.

Regras:

- Use letras, números e sublinhado, começando por letra, sem espaços nem acentos: `{multa_rescisao}`.
- Todos os campos extras são **obrigatórios** na geração.
- A mesma variável usada várias vezes no texto é pedida uma vez só.
- O card **Conteúdo** mostra em **Campos preenchidos ao gerar** a lista atual. Se aparecer "Nenhum: todos os dados vêm
  do evento.", o documento é gerado sem perguntas.
- Na lista de modelos, a linha **Campos ao gerar** de cada card mostra os campos extras.

## Perguntas frequentes

### Digitei uma variável errada e ela virou campo extra.

Corrija o nome no texto (por exemplo, `{cliente}` em vez de `{clientes}`) e salve. O campo extra some da lista.

### O valor total veio diferente da proposta enviada.

O documento usa o total da versão **atual** do orçamento. Se você criou uma versão nova depois de enviar a proposta,
o valor é o da versão nova.

### Como incluir as parcelas no contrato?

Cadastre o plano de pagamento do evento no financeiro e use `{plano_pagamento}` no texto.

## Artigos relacionados

- [Criar um modelo de documento](01-criar-modelo-de-documento.md)
- [Gerar documento no evento](03-gerar-documento-no-evento.md)
- [Plano de pagamento do evento](../11-financeiro/04-plano-de-pagamento-do-evento.md)
- [Versões do orçamento](../04-orcamento/08-versoes-do-orcamento.md)

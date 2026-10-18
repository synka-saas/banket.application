---
title: Cadastrar cliente
description: Como cadastrar, pesquisar, editar e excluir clientes pessoa física ou jurídica.
category: Clientes
order: 1
updatedAt: 2026-10-18
tags: [clientes, cadastro, cpf, cnpj]
---

# Cadastrar cliente

O módulo **Clientes** reúne as pessoas e empresas que contratam o seu buffet. Cada cliente pode ter vários eventos, e o
cadastro guarda os dados de contato usados nas propostas, nos contratos e nos e-mails.

> **Disponível em:** planos Essencial, Profissional, Prime e Master · **Quem pode usar:** todos os usuários

## Antes de começar

Nem sempre é preciso cadastrar o cliente à mão. Ele também é criado automaticamente:

- quando alguém envia um pedido pelo formulário de captação ou pelo Banket Busca (se o e-mail já existir, o Banket usa o
  cliente já cadastrado);
- quando você cadastra um evento e informa um cliente novo no mesmo formulário.

## Passo a passo

1. No menu lateral, clique em **Clientes**.
2. Clique em **Novo cliente**.
3. Preencha os campos (veja a tabela abaixo).
4. Clique em **Salvar**.

O cliente aparece na lista com a mensagem "Cliente cadastrado."

## Entenda os campos

| Campo | O que preencher |
|---|---|
| **Tipo** | **Pessoa física** ou **Pessoa jurídica**. Muda o campo de documento para CPF ou CNPJ. |
| **CPF** / **CNPJ** | Opcional. O Banket confere se o número é válido. |
| **Nome / razão social** | Obrigatório. Nome da pessoa ou razão social da empresa. |
| **E-mail** | Opcional. Usado para enviar propostas, documentos e pesquisas. |
| **Telefone / WhatsApp** | Opcional. |
| **Endereço** | Opcional. Rua, número, bairro, cidade e UF numa linha só. |
| **Observações** | Opcional. Informações internas sobre o cliente. |

### Regras do cadastro

- O **e-mail** não pode se repetir entre os clientes da empresa (sem diferenciar maiúsculas e minúsculas).
- O **CPF/CNPJ** também não pode se repetir.
- Os dados do cliente são usados nas variáveis dos documentos e das propostas, como nome, documento e endereço.

## Pesquisar e filtrar

Na lista de clientes:

- Use a busca **Pesquisar por nome, e-mail ou documento**. Para documento, você pode digitar só os números.
- Use o filtro **Tipo de cliente** para ver só pessoas físicas ou só jurídicas.
- Clique nos títulos **Nome** ou **Eventos** para ordenar a lista.

A lista mostra o nome, o CPF/CNPJ, o contato (e-mail e telefone) e quantos eventos cada cliente tem.

## Editar um cliente

1. Na lista, clique em **Editar** na linha do cliente. Ou abra o cliente e clique em **Editar**.
2. Altere os campos e clique em **Salvar**.

## Excluir um cliente

1. Abra a edição do cliente.
2. Clique em **Excluir** e confirme.

Clientes com eventos **não podem ser excluídos**. Para excluir, primeiro exclua os eventos dele ou associe-os a outro
cliente.

## Perguntas frequentes

### Apareceu "Este e-mail já está cadastrado".

Já existe um cliente com esse e-mail na empresa. Pesquise pelo e-mail na lista para encontrá-lo e use o cadastro
existente.

### Apareceu "CPF/CNPJ inválido".

O número digitado não é um CPF ou CNPJ válido. Confira os dígitos e se o **Tipo** está certo (CPF para pessoa física,
CNPJ para pessoa jurídica).

### Apareceu "Este cliente possui eventos e não pode ser excluído".

O cliente tem eventos ligados a ele. Isso protege o histórico das propostas e dos contratos.

### O cliente que preencheu o formulário apareceu duplicado.

O Banket reconhece o cliente pelo e-mail. Se a pessoa usou outro e-mail, um novo cadastro é criado. Você pode corrigir o
e-mail num dos cadastros, mas não é possível juntar dois clientes.

## Artigos relacionados

- [Detalhe e histórico do cliente](02-detalhe-e-historico-do-cliente.md)
- [Importar clientes por CSV](03-importar-clientes-por-csv.md)
- [Criar um evento](../03-propostas-e-eventos/02-criar-evento.md)
- [Como o pedido vira evento](../10-formularios/04-como-o-pedido-vira-evento.md)

import { describe, expect, it } from 'vitest';
import { fieldErrors } from '../lib/forms';
import { errosDoFormularioEvento, validarFormularioEvento } from './eventos';

const erroDe = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('esperava erro');
};

describe('validarFormularioEvento', () => {
  it('devolve os erros do evento e do cliente novo juntos, com os nomes dos campos do formulário', () => {
    const err = erroDe(() =>
      validarFormularioEvento({
        cliente_novo: '1',
        cliente_tipo_pessoa: 'PF',
        cliente_nome: 'Ana Souza',
        cliente_documento: '123.456.789-00',
        hora_inicio: '20:00',
        hora_fim: '19:00',
      })
    );
    const campos = fieldErrors(err);
    expect(campos.hora_fim).toBe('O horário de término deve ser depois do início.');
    expect(campos.cliente_documento).toBe('CPF/CNPJ inválido.');
  });

  it('sem cliente escolhido nem novo, aponta o campo do cliente', () => {
    expect(fieldErrors(erroDe(() => validarFormularioEvento({ cliente_novo: '0' })))).toHaveProperty('cliente_id');
  });

  it('duplicidade na tabela de clientes aponta para os campos do cliente novo', () => {
    const pg = Object.assign(new Error('dup'), { code: '23505', constraint: 'clientes_email_unique' });
    expect(errosDoFormularioEvento(pg)).toEqual({ cliente_email: 'Este e-mail já está cadastrado.' });
  });
});

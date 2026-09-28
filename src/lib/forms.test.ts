import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { UserError, fieldErrors, userMessage } from './forms';

const pgErro = (code: string, constraint?: string) => Object.assign(new Error('pg'), { code, constraint });

describe('fieldErrors', () => {
  it('usa o primeiro erro de cada campo do zod (inclusive de refine com path)', () => {
    const schema = z
      .object({ nome: z.string().min(1, 'Informe o nome.'), email: z.email('E-mail inválido.') })
      .refine(() => false, { message: 'Documento inválido.', path: ['documento'] });
    const r = schema.safeParse({ nome: '', email: 'x' });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error)).toEqual({ nome: 'Informe o nome.', email: 'E-mail inválido.', documento: 'Documento inválido.' });
  });

  it('refine sem path não aponta campo', () => {
    const r = z.object({ a: z.string() }).refine(() => false, 'Geral.').safeParse({ a: 'x' });
    expect(fieldErrors(r.error)).toEqual({});
  });

  it('UserError com campo', () => {
    expect(fieldErrors(new UserError('Seção não encontrada.', 'secao_id'))).toEqual({ secao_id: 'Seção não encontrada.' });
    expect(fieldErrors(new UserError('Sem campo.'))).toEqual({});
  });

  it('duplicidade do Postgres pelo nome da restrição', () => {
    expect(fieldErrors(pgErro('23505', 'clientes_email_unique'))).toEqual({ email: 'Este e-mail já está cadastrado.' });
    expect(fieldErrors(pgErro('23505', 'clientes_documento_unique'))).toEqual({ documento: 'Este CPF/CNPJ já está cadastrado.' });
    expect(fieldErrors(pgErro('23505', 'tipos_evento_nome_unique'))).toEqual({ nome: 'Já existe um cadastro com este nome.' });
    expect(fieldErrors(pgErro('23505', 'orcamento_templates_tenant_id_nome_key'))).toEqual({ nome: 'Já existe um cadastro com este nome.' });
    expect(fieldErrors(pgErro('23505', 'orcamentos_evento_id_key'))).toEqual({});
  });
});

describe('userMessage', () => {
  it('mensagem específica de duplicidade, genérica quando não reconhece', () => {
    expect(userMessage(pgErro('23505', 'staff_servicos_funcao_unique'))).toBe('Já existe uma função com este nome.');
    expect(userMessage(pgErro('23505', 'x_y_key'))).toBe('Já existe um registro com esses dados.');
    expect(userMessage(pgErro('23503'))).toBe('Este registro está em uso e não pode ser removido.');
  });
});

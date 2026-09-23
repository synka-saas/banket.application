import { describe, expect, it } from 'vitest';
import { cadastroSchema, empresaNovaSchema, slugify } from './autoatendimento';

describe('autoatendimento', () => {
  it('gera slug sem acentos nem símbolos', () => {
    expect(slugify('Buffet São João & Cia.')).toBe('buffet-sao-joao-cia');
    expect(slugify('***')).toBe('empresa');
  });

  it('cadastro exige nome e sobrenome, senha forte e termos', () => {
    const base = { nome: 'Ana Souza', email: ' Ana@Exemplo.com ', senha: 'Senha.123', confirma_senha: 'Senha.123', termos: 'on' };
    expect(cadastroSchema.parse(base).email).toBe('ana@exemplo.com');
    expect(() => cadastroSchema.parse({ ...base, nome: 'Ana' })).toThrow(/sobrenome/);
    expect(() => cadastroSchema.parse({ ...base, senha: 'fraca', confirma_senha: 'fraca' })).toThrow();
    expect(() => cadastroSchema.parse({ ...base, confirma_senha: 'Outra.123' })).toThrow(/conferem/);
    expect(() => cadastroSchema.parse({ ...base, termos: undefined })).toThrow(/Termos/);
  });

  it('empresa PJ valida CNPJ e razão social; PF valida CPF', () => {
    const pj = { tipo_pessoa: 'PJ', celular: '(11) 98765-4321', cnpj: '11.222.333/0001-81', razao_social: 'Buffet Ltda', endereco: 'Rua A, 1' };
    const ok = empresaNovaSchema.parse(pj);
    expect(ok.cnpj).toBe('11222333000181');
    expect(ok.celular).toBe('11987654321');
    expect(() => empresaNovaSchema.parse({ ...pj, cnpj: '11.222.333/0001-00' })).toThrow(/CNPJ/);
    expect(() => empresaNovaSchema.parse({ ...pj, razao_social: '' })).toThrow(/razão social/);
    expect(() => empresaNovaSchema.parse({ tipo_pessoa: 'PF', celular: '11987654321', cpf: '111.111.111-11', endereco: 'Rua A' })).toThrow(/CPF/);
    expect(empresaNovaSchema.parse({ tipo_pessoa: 'PF', celular: '11987654321', cpf: '529.982.247-25', endereco: 'Rua A' }).cpf).toBe('52998224725');
    expect(() => empresaNovaSchema.parse({ ...pj, celular: '1234' })).toThrow(/Celular/);
  });
});

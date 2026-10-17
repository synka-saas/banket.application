import { describe, expect, it } from 'vitest';
import { buscarCep, enderecoCompleto, formatarCep } from './endereco';

describe('enderecoCompleto', () => {
  it('monta o texto com as partes preenchidas', () => {
    expect(
      enderecoCompleto({ cep: '01001000', logradouro: 'Praça da Sé', numero: '100', complemento: 'Sala 2', bairro: 'Sé', cidade: 'São Paulo', uf: 'sp' })
    ).toBe('Praça da Sé, 100, Sala 2 – Sé, São Paulo/SP, CEP 01001-000');
    expect(enderecoCompleto({ logradouro: 'Rua A', cidade: 'Campinas', uf: 'SP' })).toBe('Rua A, Campinas/SP');
    expect(enderecoCompleto({ cep: '123' })).toBeNull();
    expect(enderecoCompleto({})).toBeNull();
  });
  it('formata o CEP', () => {
    expect(formatarCep('01001000')).toBe('01001-000');
  });
});

describe('buscarCep', () => {
  const resposta = (corpo: unknown) => (async () => new Response(JSON.stringify(corpo))) as unknown as typeof fetch;
  it('traduz a resposta da ViaCEP', async () => {
    const r = await buscarCep('01001-000', resposta({ logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' }));
    expect(r).toEqual({ logradouro: 'Praça da Sé', bairro: 'Sé', cidade: 'São Paulo', uf: 'SP', complemento: '' });
  });
  it('CEP inválido ou não encontrado', async () => {
    expect(await buscarCep('123', resposta({}))).toBeNull();
    expect(await buscarCep('99999999', resposta({ erro: 'true' }))).toBeNull();
  });
});

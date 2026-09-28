import { describe, expect, it } from 'vitest';
import { csvComCabecalho, detectarSeparador, parseCsv } from './csv';

describe('parseCsv', () => {
  it('lê ponto e vírgula com aspas e quebras', () => {
    const csv = 'nome;email\r\n"Silva; Filhos";a@b.com\r\n"Diz ""oi""";c@d.com\r\n';
    expect(parseCsv(csv)).toEqual([
      ['nome', 'email'],
      ['Silva; Filhos', 'a@b.com'],
      ['Diz "oi"', 'c@d.com'],
    ]);
  });

  it('detecta vírgula e ignora linhas vazias e BOM', () => {
    expect(detectarSeparador('a,b,c\n')).toBe(',');
    expect(parseCsv('﻿a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('csvComCabecalho', () => {
  it('normaliza colunas e numera as linhas do arquivo', () => {
    const { linhas, colunas } = csvComCabecalho('Nome;E-mail;Endereço\nAna;a@b.com;Rua 1\n;faltando@x.com;\n');
    expect(colunas).toEqual(['nome', 'e-mail', 'endereco']);
    expect(linhas[0]).toEqual({ numero: 2, valores: { nome: 'Ana', 'e-mail': 'a@b.com', endereco: 'Rua 1' } });
    expect(linhas[1].numero).toBe(3);
  });
});

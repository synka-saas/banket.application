// Leitura de CSV para as importações (UX-053). Puro: roda no servidor e nos testes.
// Aceita ";" (Excel em português) ou ",", campos entre aspas duplas (com "" escapado) e quebras \r\n.

/** Descobre o separador pela primeira linha: o que aparecer mais fora de aspas. */
export function detectarSeparador(texto: string): ';' | ',' {
  const linha = texto.slice(0, texto.indexOf('\n') === -1 ? undefined : texto.indexOf('\n'));
  let pv = 0;
  let virgula = 0;
  let aspas = false;
  for (const ch of linha) {
    if (ch === '"') aspas = !aspas;
    else if (!aspas && ch === ';') pv++;
    else if (!aspas && ch === ',') virgula++;
  }
  return pv >= virgula ? ';' : ',';
}

/** CSV → linhas de células (sem descartar vazias no meio; linhas totalmente vazias saem). */
export function parseCsv(texto: string, separador?: ';' | ','): string[][] {
  const sep = separador ?? detectarSeparador(texto);
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = '';
  let aspas = false;
  const limpo = texto.replace(/^﻿/, '');
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i];
    if (aspas) {
      if (ch === '"') {
        if (limpo[i + 1] === '"') {
          celula += '"';
          i++;
        } else {
          aspas = false;
        }
      } else {
        celula += ch;
      }
    } else if (ch === '"') {
      aspas = true;
    } else if (ch === sep) {
      linha.push(celula);
      celula = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && limpo[i + 1] === '\n') i++;
      linha.push(celula);
      celula = '';
      if (linha.some((c) => c.trim() !== '')) linhas.push(linha);
      linha = [];
    } else {
      celula += ch;
    }
  }
  linha.push(celula);
  if (linha.some((c) => c.trim() !== '')) linhas.push(linha);
  return linhas;
}

/**
 * CSV com cabeçalho → objetos por linha ({coluna: valor}, chaves em minúsculas sem acento).
 * Devolve também o número da linha original (para apontar erros).
 */
export function csvComCabecalho(texto: string): { linhas: { numero: number; valores: Record<string, string> }[]; colunas: string[] } {
  const bruto = parseCsv(texto);
  if (!bruto.length) return { linhas: [], colunas: [] };
  const normalizar = (c: string) =>
    c
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '_');
  const colunas = bruto[0].map(normalizar);
  const linhas = bruto.slice(1).map((celulas, i) => ({
    numero: i + 2,
    valores: Object.fromEntries(colunas.map((c, j) => [c, (celulas[j] ?? '').trim()])),
  }));
  return { linhas, colunas };
}

// Números e datas por extenso (pt-BR) para documentos formais: "R$ 1.250,00" → "mil duzentos e cinquenta reais".
// Função pura: roda no navegador (prévia do editor) e no servidor (geração do documento).

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const ESCALAS: [string, string][] = [
  ['', ''],
  ['mil', 'mil'],
  ['milhão', 'milhões'],
  ['bilhão', 'bilhões'],
  ['trilhão', 'trilhões'],
];

function ateNovecentos(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c) partes.push(CENTENAS[c]);
  if (resto < 20) {
    if (resto) partes.push(UNIDADES[resto]);
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
  }
  return partes.join(' e ');
}

/** Inteiro não negativo por extenso ("mil duzentos e trinta e quatro"). */
export function numeroPorExtenso(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  if (n === 0) return 'zero';
  const grupos: number[] = [];
  let resto = n;
  while (resto > 0) {
    grupos.push(resto % 1000);
    resto = Math.floor(resto / 1000);
  }
  const partes: string[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (!g) continue;
    const [singular, plural] = ESCALAS[i] ?? ['', ''];
    if (i === 1 && g === 1) partes.push('mil');
    else if (i >= 1) partes.push(`${ateNovecentos(g)} ${g === 1 ? singular : plural}`);
    else partes.push(ateNovecentos(g));
  }
  // "e" antes do último grupo quando ele é menor que cem ou múltiplo de cem (regra da língua)
  const ultimo = grupos[0];
  if (partes.length > 1 && ultimo && (ultimo < 100 || ultimo % 100 === 0)) {
    const fim = partes.pop()!;
    return `${partes.join(' ')} e ${fim}`;
  }
  return partes.join(' ');
}

/** Valor em reais por extenso ("mil duzentos e cinquenta reais e dez centavos"). */
export function valorPorExtenso(valor: number): string {
  const centavosTotal = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(centavosTotal / 100);
  const centavos = centavosTotal % 100;
  const partes: string[] = [];
  if (reais) partes.push(`${numeroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`);
  if (centavos) partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  if (!partes.length) return 'zero reais';
  return partes.join(' e ');
}

const MESES_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Data ISO (AAAA-MM-DD) por extenso ("6 de outubro de 2026"). Inválida → ''. */
export function dataPorExtenso(iso: string | null | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const mes = MESES_EXTENSO[Number(m[2]) - 1];
  if (!mes) return '';
  return `${Number(m[3])} de ${mes} de ${m[1]}`;
}

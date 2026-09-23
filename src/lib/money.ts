// Conversão de valores monetários digitados no formato brasileiro. Usado no servidor e nas ilhas.

/** "1.234,56", "1234.56", "R$ 20" → número; vazio → null; inválido → NaN. */
export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const s = String(value).trim().replace(/[R$\s]/g, '');
  if (!s) return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Valor para preencher um input de texto ("250,00"). */
export function moneyInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toFixed(2).replace('.', ',');
}

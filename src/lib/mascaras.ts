// Máscaras de digitação (puras: rodam no navegador e nos testes). O servidor aceita os valores com ou sem pontuação.
// Ligação aos campos: data-mascara="…" (components/ui/Mascaras.astro).
import { mascararDocumento } from './documento';
import { parseMoney } from './money';

const digitos = (v: string) => v.replace(/\D/g, '');

/** Telefone com DDD: fixo (10 dígitos) "(11) 3333-4444", celular (11) "(11) 93333-4444". */
export function mascararTelefone(valor: string): string {
  const d = digitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = d.length === 11 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/**
 * Telefone brasileiro com DDD: 10 dígitos (fixo) ou 11 (celular, começa com 9 depois do DDD); aceita +55 na frente.
 * DDD com dois dígitos de 1 a 9. "(99) 3213-836" (sem um dígito) ou "93213-8360" (sem DDD) não passam.
 */
export function telefoneValido(valor: string): boolean {
  let d = digitos(valor);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (!/^[1-9][1-9]/.test(d)) return false;
  if (d.length === 11) return d[2] === '9';
  return d.length === 10 && /[2-8]/.test(d[2]);
}

/** CEP "00000-000". */
export function mascararCep(valor: string): string {
  const d = digitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Só dígitos (quantidades), com limite de tamanho. */
export function mascararNumero(valor: string, max = 7): string {
  return digitos(valor).slice(0, max);
}

/** Dinheiro ao sair do campo: "1500" → "1.500,00", "1500,5" → "1.500,50"; texto inválido fica como está. */
export function formatarDinheiro(valor: string): string {
  const n = parseMoney(valor);
  if (n === null || Number.isNaN(n)) return valor.trim();
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type TipoMascara = 'telefone' | 'cep' | 'numero' | 'cpf' | 'cnpj' | 'documento' | 'dinheiro';

/** Aplica a máscara de digitação; `tipoPessoa` só vale para "documento" (PF → CPF, PJ → CNPJ). */
export function aplicarMascara(tipo: TipoMascara, valor: string, tipoPessoa: 'PF' | 'PJ' = 'PF'): string {
  switch (tipo) {
    case 'telefone':
      return mascararTelefone(valor);
    case 'cep':
      return mascararCep(valor);
    case 'numero':
      return mascararNumero(valor);
    case 'cpf':
      return mascararDocumento(valor, 'PF');
    case 'cnpj':
      return mascararDocumento(valor, 'PJ');
    case 'documento':
      return mascararDocumento(valor, tipoPessoa);
    case 'dinheiro':
      return valor;
  }
}

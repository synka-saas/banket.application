import { z } from 'zod';
import { parseMoney } from './money';

/**
 * Converte FormData em objeto simples. Campos repetidos (checkbox múltiplo)
 * e campos listados em `arrays` viram arrays.
 */
export function formToObject(data: FormData, arrays: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(data.keys())) {
    const all = data.getAll(key).map((v) => (typeof v === 'string' ? v : v.name));
    out[key] = arrays.includes(key) || all.length > 1 ? all : all[0];
  }
  for (const key of arrays) if (!(key in out)) out[key] = [];
  return out;
}

/** Primeira mensagem de erro de validação, pronta para exibir ao usuário. */
export function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Dados inválidos.';
}

/** Erro de negócio com mensagem segura para o usuário. */
export class UserError extends Error {}

/** Traduz erros conhecidos do Postgres para mensagens de negócio. */
export function userMessage(err: unknown, fallback = 'Ocorreu um erro ao processar a requisição.'): string {
  if (err instanceof UserError) return err.message;
  if (err instanceof z.ZodError) return validationMessage(err);
  const code = (err as { code?: string })?.code;
  if (code === '23505') return 'Já existe um registro com esses dados.';
  if (code === '23503') return 'Este registro está em uso e não pode ser removido.';
  if (code === '22P02') return 'Identificador inválido.';
  console.error(err);
  return fallback;
}

// ---------- Preprocessadores comuns para campos de formulário ----------

/** Texto opcional: string vazia vira null. */
export const optionalText = (max = 1000) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v),
    z.string().max(max, `Máximo de ${max} caracteres.`).nullable().optional()
  );

/** E-mail opcional, normalizado em minúsculas; vazio ou ausente vira null. */
export const optionalEmail = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim().toLowerCase() : null),
    z.email('E-mail inválido.').nullable()
  );

/** Texto obrigatório com mensagem própria. */
export const requiredText = (message: string, max = 255) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string({ error: message }).min(1, message).max(max, `Máximo de ${max} caracteres.`)
  );

/** Número decimal no formato brasileiro ("1.234,56") ou internacional; vazio vira null. */
export const optionalMoney = () =>
  z.preprocess((v) => parseMoney(v), z.number({ error: 'Valor inválido.' }).min(0, 'O valor não pode ser negativo.').nullable());

export const optionalInt = () =>
  z.preprocess((v) => {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    return Number.parseInt(String(v), 10);
  }, z.number({ error: 'Número inválido.' }).int().min(0, 'Informe um número positivo.').nullable());

export const optionalUuid = () =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), z.uuid('Seleção inválida.').nullable());

export const checkbox = () => z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const stringArray = () =>
  z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.string()));

/** Formata número como moeda brasileira. */
export function brl(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dataBR(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/** Lista de tags a partir de "a, b, c" ou array; remove vazias e repetidas (sem diferenciar maiúsculas). */
export const tagList = (max = 10) =>
  z.preprocess(
    (v) =>
      (Array.isArray(v) ? v : String(v ?? '').split(','))
        .map((t) => String(t).trim())
        .filter((t, i, lista) => t && lista.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i),
    z.array(z.string().max(40, 'Cada tag pode ter no máximo 40 caracteres.')).max(max, `Use no máximo ${max} tags.`)
  );

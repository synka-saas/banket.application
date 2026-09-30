// HCP v1 — leitura do snapshot de entitlements empurrado pelo Manager.
// Regra: conta SEM snapshot não sofre restrição (integrar não pode quebrar contas existentes).
import adapter from './adapter';
import type { HwestaEntitlements } from './types';

const TTL_MS = 60_000;
const cache = new Map<string, { value: HwestaEntitlements | null; expires: number }>();

export async function getEntitlements(accountId: string): Promise<HwestaEntitlements | null> {
  const hit = cache.get(accountId);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await adapter.getEntitlements(accountId);
  cache.set(accountId, { value, expires: Date.now() + TTL_MS });
  return value;
}

export function invalidateEntitlements(accountId: string): void {
  cache.delete(accountId);
}

/** Feature booleana. Sem snapshot ou sem a chave => `fallback` (padrão true). */
export async function can(accountId: string, key: string, fallback = true): Promise<boolean> {
  const ent = await getEntitlements(accountId);
  const v = ent?.capabilities?.[key];
  if (v === undefined || v === null) return fallback;
  return v === true || v === 'true' || (typeof v === 'number' && v > 0);
}

/** Limite numérico. Sem snapshot ou sem a chave => `fallback` (padrão Infinity = sem limite). */
export async function limit(accountId: string, key: string, fallback = Number.POSITIVE_INFINITY): Promise<number> {
  const ent = await getEntitlements(accountId);
  const v = ent?.capabilities?.[key];
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? (n < 0 ? Number.POSITIVE_INFINITY : n) : fallback;
}

/** Atalho para "pode criar mais um?": compara o uso atual com o limite. */
export async function withinLimit(accountId: string, key: string, currentUsage: number): Promise<boolean> {
  return currentUsage < (await limit(accountId, key));
}

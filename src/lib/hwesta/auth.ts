// HCP v1 — autenticação das chamadas Manager -> app.
import { createHmac, timingSafeEqual } from 'node:crypto';

export function hwestaEnv(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Retorna uma Response de erro se a chamada não vier do Manager; null se estiver autorizada. */
export function requireManager(request: Request): Response | null {
  const expected = hwestaEnv('HWESTA_MANAGER_KEY');
  if (!expected || expected.length < 32) return json({ error: 'HCP não configurado neste app (HWESTA_MANAGER_KEY)' }, 503);
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !safeEqual(token, expected)) return json({ error: 'Não autorizado' }, 401);
  return null;
}

/** Confere X-Hwesta-Signature (HMAC-SHA256 do corpo bruto com HWESTA_MANAGER_KEY). */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = hwestaEnv('HWESTA_MANAGER_KEY');
  if (!secret || !header) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(header, expected);
}

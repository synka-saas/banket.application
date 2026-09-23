import type { AstroCookies } from 'astro';

// Mensagens de feedback que sobrevivem a um redirect (padrão POST → redirect → GET).
// O middleware lê o cookie, expõe em Astro.locals.flash e o apaga.

export const FLASH_COOKIE = 'banket_flash';

export type FlashType = 'success' | 'error' | 'info';

export interface Flash {
  type: FlashType;
  message: string;
}

export function setFlash(cookies: AstroCookies, type: FlashType, message: string) {
  cookies.set(FLASH_COOKIE, JSON.stringify({ type, message }), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60,
  });
}

export function consumeFlash(cookies: AstroCookies): Flash | null {
  const raw = cookies.get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  cookies.delete(FLASH_COOKIE, { path: '/' });
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string') {
      return { type: parsed.type ?? 'info', message: parsed.message };
    }
  } catch {
    // cookie corrompido: ignora
  }
  return null;
}

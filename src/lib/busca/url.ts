// Endereços do Banket Busca. Em produção a vitrine responde em BUSCA_URL (https://busca.banket.com.br) pelo mesmo
// app (rewrite por host no middleware, fase 3); sem BUSCA_URL (dev), a vitrine fica em APP_URL + /vitrine.
import { appUrl } from '../mail';

function env(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
}

/** Host da vitrine (ex.: busca.banket.com.br) ou null em dev. */
export const hostVitrine = (): string | null => {
  const url = env('BUSCA_URL');
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
};

/** URL absoluta de uma página da vitrine. */
export function buscaUrl(path = '/'): string {
  const base = env('BUSCA_URL')?.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p === '/' ? '' : p}` || base : appUrl(`/vitrine${p === '/' ? '' : p}`);
}

/** Caminho relativo de uma página da vitrine dentro da própria vitrine (sem host). */
export function caminhoVitrine(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return env('BUSCA_URL') ? p : `/vitrine${p === '/' ? '' : p}`;
}

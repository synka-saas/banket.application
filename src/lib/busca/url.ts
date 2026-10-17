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

/** BUSCA_URL sem barra no fim, ou null. */
export const urlVitrine = (): string | null => env('BUSCA_URL')?.replace(/\/$/, '') || null;

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

/**
 * Página da área do buffet / autenticação: sempre no app (app.banket.com.br, menu Banket Busca).
 * Ex.: urlArea('/auth/cadastro?plano=busca').
 */
export function urlArea(path: string): string {
  return appUrl(path);
}

/** A requisição chegou pelo host do Busca? */
export const noHostBusca = (url: URL): boolean => {
  const h = hostVitrine();
  return Boolean(h) && url.host.toLowerCase() === h!.toLowerCase();
};

/** Para onde vai quem acabou de entrar: a área do Busca no host do Busca, o dashboard no app. */
export const inicioAposLogin = (url: URL): string => (noHostBusca(url) ? '/busca' : '/dashboard');

/** Arquivo da imagem padrão dos buffets (public/thumb-buffet.webp); é o `path` gravado nas fotos de demonstração. */
export const ARQUIVO_FOTO_PADRAO = '/thumb-buffet.webp';
/**
 * URL da imagem padrão (card, perfil e og:image dos buffets sem foto própria). O `?v=` muda quando a imagem é
 * trocada, para o navegador e o Cloudflare (cache de 4 h) buscarem a nova: use os 8 primeiros caracteres do md5sum.
 */
export const FOTO_PADRAO = `${ARQUIVO_FOTO_PADRAO}?v=f5784750`;

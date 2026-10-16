// Apoio às páginas públicas da vitrine: critérios a partir da URL (inclusive a cidade digitada sem JavaScript) e
// os cabeçalhos de cache (as páginas não dependem de sessão; o Cloudflare guarda por 5 minutos).
import { hojeSaoPaulo } from '../../lib/datas';
import { lerCriterios, type Criterios } from '../../lib/busca/filtros';
import { slugTexto } from '../../lib/busca/geo';

/** "Santo André · SP" → "santo-andre-sp"; "Moema, São Paulo" → "sao-paulo"; vazio → null. */
export function slugDaCidadeDigitada(texto: string | null): string | null {
  const t = (texto ?? '').trim();
  if (t.length < 2) return null;
  const [nome, uf] = t.split(/\s*[·|/]\s*|\s+-\s+/);
  const partes = nome.split(',').map((s) => s.trim()).filter(Boolean);
  const base = slugTexto(partes[partes.length - 1] ?? nome, 120);
  return uf && /^[a-z]{2}$/i.test(uf.trim()) ? `${base}-${uf.trim().toLowerCase()}` : base;
}

export function criteriosDaUrl(url: URL): Criterios {
  const p = new URLSearchParams(url.search);
  if (!p.get('cidade')) {
    const digitada = slugDaCidadeDigitada(p.get('cidade_texto'));
    if (digitada) p.set('cidade', digitada);
  }
  return lerCriterios(p, hojeSaoPaulo());
}

export function cachePublico(headers: Headers, segundos = 300): void {
  headers.set('Cache-Control', `public, max-age=60, s-maxage=${segundos}, stale-while-revalidate=600`);
}

/** Máximo de buffets num pedido de orçamento (seleção múltipla). */
export const MAX_SELECAO = 5;

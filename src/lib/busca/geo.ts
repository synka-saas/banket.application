// Geografia do Banket Busca (puro). A distância oficial é calculada no Postgres (earthdistance); esta versão em
// memória serve aos predicados de matching testados e às telas.

const RAIO_TERRA_KM = 6371;

/** Distância em km entre dois pontos (haversine). */
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Texto sem acento, minúsculo, com hífens: base dos slugs de perfil e de cidade. */
export function slugTexto(texto: string, max = 70): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/g, '') || 'buffet'
  );
}

/** Slug de cidade da tabela busca_cidades: "Santo André" + "SP" → "santo-andre-sp". */
export const slugCidade = (nome: string, uf: string) => `${slugTexto(nome, 120)}-${uf.toLowerCase()}`;

/** "12,4 km" / "800 m" */
export function formatarDistancia(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m`;
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

/** CEP com 8 dígitos ou null. */
export function cepValido(v: unknown): string | null {
  const d = typeof v === 'string' ? v.replace(/\D/g, '') : '';
  return d.length === 8 ? d : null;
}

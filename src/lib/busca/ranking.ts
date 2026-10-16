// Ranking da busca (PLANO.md §8): grupo primeiro (clientes Banket com prioridade antes dos gratuitos), depois a
// pontuação de relevância dentro do grupo. Puro, com pesos configuráveis (BUSCA_RANKING_PESOS) e testes.
import type { Ordem } from './filtros';

export interface Pesos {
  completude: number;
  avaliacao: number;
  resposta: number;
  distancia: number;
}

export const PESOS_PADRAO: Pesos = { completude: 0.3, avaliacao: 0.3, resposta: 0.2, distancia: 0.2 };
/** Quantas avaliações dão confiança total à nota (abaixo disso, a nota pesa proporcionalmente). */
export const AVALIACOES_CONFIANCA = 10;
export const RAIO_REFERENCIA_KM = 30;

export interface Rankeavel {
  id: string;
  nome: string;
  /** Recurso busca_prioridade do plano (clientes Banket) */
  prioridade: boolean;
  completude: number; // 0..100
  notaMedia: number | null; // 1..5
  totalAvaliacoes: number;
  taxaResposta: number | null; // 0..1
  distanciaKm: number | null;
  precoMin: number | null;
}

/** Pesos do ambiente (JSON parcial) normalizados para somar 1; inválido → padrão. */
export function lerPesos(json: string | undefined | null): Pesos {
  if (!json) return PESOS_PADRAO;
  try {
    const p = { ...PESOS_PADRAO, ...JSON.parse(json) } as Pesos;
    const vals = Object.values(p);
    if (vals.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) return PESOS_PADRAO;
    const soma = vals.reduce((a, b) => a + b, 0);
    if (soma <= 0) return PESOS_PADRAO;
    return { completude: p.completude / soma, avaliacao: p.avaliacao / soma, resposta: p.resposta / soma, distancia: p.distancia / soma };
  } catch {
    return PESOS_PADRAO;
  }
}

/** Fatores de 0 a 1 de cada critério. */
export function fatores(r: Rankeavel, raioRef = RAIO_REFERENCIA_KM) {
  const completude = Math.min(Math.max(r.completude, 0), 100) / 100;
  const avaliacao = r.notaMedia ? (r.notaMedia / 5) * Math.min(1, r.totalAvaliacoes / AVALIACOES_CONFIANCA) : 0;
  const resposta = r.taxaResposta == null ? 0.5 : Math.min(Math.max(r.taxaResposta, 0), 1);
  const distancia = r.distanciaKm == null ? 0.5 : 1 - Math.min(r.distanciaKm, raioRef) / raioRef;
  return { completude, avaliacao, resposta, distancia };
}

export function pontuar(r: Rankeavel, pesos: Pesos = PESOS_PADRAO, raioRef = RAIO_REFERENCIA_KM): number {
  const f = fatores(r, raioRef);
  return pesos.completude * f.completude + pesos.avaliacao * f.avaliacao + pesos.resposta * f.resposta + pesos.distancia * f.distancia;
}

const nulosNoFim = (a: number | null, b: number | null, asc: boolean) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return asc ? a - b : b - a;
};

/**
 * Ordena mantendo sempre o grupo prioritário na frente. Dentro do grupo: relevância (pontos), melhor avaliados,
 * menor preço ou mais próximos. Empates: mais avaliações, depois nome.
 */
export function ordenar<T extends Rankeavel>(lista: T[], ordem: Ordem = 'relevancia', pesos: Pesos = PESOS_PADRAO, raioRef = RAIO_REFERENCIA_KM): T[] {
  const pontos = new Map(lista.map((r) => [r.id, pontuar(r, pesos, raioRef)]));
  return [...lista].sort((a, b) => {
    if (a.prioridade !== b.prioridade) return a.prioridade ? -1 : 1;
    let d = 0;
    if (ordem === 'avaliacao') d = nulosNoFim(a.notaMedia, b.notaMedia, false) || b.totalAvaliacoes - a.totalAvaliacoes;
    else if (ordem === 'preco') d = nulosNoFim(a.precoMin, b.precoMin, true);
    else if (ordem === 'distancia') d = nulosNoFim(a.distanciaKm, b.distanciaKm, true);
    if (d === 0) d = (pontos.get(b.id) ?? 0) - (pontos.get(a.id) ?? 0);
    if (Math.abs(d) < 1e-12) d = b.totalAvaliacoes - a.totalAvaliacoes;
    return d !== 0 ? d : a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

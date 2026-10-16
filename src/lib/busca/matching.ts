// Compatibilidade de um buffet com a busca (eliminatório) e disponibilidade na data. Puro e testado; o SQL de
// server/busca/busca.ts faz um pré-filtro largo e esta função decide de fato, para a regra ficar num lugar só.
//
// Regras (PLANO.md §8):
//   1. Tipo de evento: precisa estar entre os atendidos.
//   2. Localização (com cidade na busca): mesma cidade, cidade atendida explicitamente, domicílio até o raio do
//      buffet ou espaço próprio até a distância de deslocamento (filtro de raio ou 30 km).
//   3. Capacidade: convidados entre o mínimo e o máximo; abaixo do mínimo só se o buffet aceita eventos menores.
//   4. Data: elimina só cliente Banket com agenda sincronizada e data ocupada; gratuito nunca é eliminado pela data.
//   Filtros secundários (também eliminatórios quando usados): serviço, restrição, modo de atendimento, nota, raio.
import type { Criterios } from './filtros';

export const DESLOCAMENTO_PADRAO_KM = 30;

export interface CandidatoBusca {
  id: string;
  cidadeId: number | null;
  /** Cidades atendidas explicitamente */
  cidadesAtendidas: number[];
  tiposEvento: string[];
  tiposServico: string[];
  restricoes: string[];
  atendeDomicilio: boolean;
  raioKm: number | null;
  espacoProprio: boolean;
  capacidadeMin: number | null;
  capacidadeMax: number | null;
  aceitaMenor: boolean;
  /** Distância até o centro da cidade buscada (null sem cidade ou sem coordenadas) */
  distanciaKm: number | null;
  notaMedia: number | null;
  /** Recurso busca_disponibilidade do plano + agenda sincronizada */
  usaAgenda: boolean;
  /** Data ocupada na agenda (só calculado com data na busca) */
  ocupado: boolean;
}

export interface CidadeBusca {
  id: number;
}

export type Atendimento = { mesmaCidade: boolean; domicilio: boolean; espaco: boolean };

/** Como o buffet atende a cidade buscada (sem cidade na busca: tudo verdadeiro). */
export function atendimento(c: CandidatoBusca, cidade: CidadeBusca | null, raioBusca: number | null): Atendimento {
  if (!cidade) return { mesmaCidade: true, domicilio: c.atendeDomicilio, espaco: c.espacoProprio };
  const mesma = c.cidadeId === cidade.id || c.cidadesAtendidas.includes(cidade.id);
  const d = c.distanciaKm;
  const domicilio = c.atendeDomicilio && (mesma || (d != null && c.raioKm != null && d <= c.raioKm));
  const limite = raioBusca ?? DESLOCAMENTO_PADRAO_KM;
  const espaco = c.espacoProprio && ((c.cidadeId === cidade.id) || (d != null && d <= limite));
  return { mesmaCidade: mesma, domicilio, espaco };
}

export function capacidadeAtende(c: Pick<CandidatoBusca, 'capacidadeMin' | 'capacidadeMax' | 'aceitaMenor'>, convidados: number | null): boolean {
  if (!convidados) return true;
  if (c.capacidadeMax != null && convidados > c.capacidadeMax) return false;
  if (c.capacidadeMin != null && convidados < c.capacidadeMin) return c.aceitaMenor;
  return true;
}

/** Disponibilidade mostrada no card: null sem data na busca. */
export function disponibilidade(c: Pick<CandidatoBusca, 'usaAgenda' | 'ocupado'>, data: string | null): 'disponivel' | 'indisponivel' | 'consultar' | null {
  if (!data) return null;
  if (!c.usaAgenda) return 'consultar';
  return c.ocupado ? 'indisponivel' : 'disponivel';
}

/** Compatibilidade eliminatória (tipo, local, capacidade, data) — sem os filtros secundários. */
export function compativel(c: CandidatoBusca, crit: Pick<Criterios, 'tipo' | 'convidados' | 'data' | 'raio'>, cidade: CidadeBusca | null): boolean {
  if (crit.tipo && !c.tiposEvento.includes(crit.tipo)) return false;
  const a = atendimento(c, cidade, crit.raio);
  if (cidade && !(a.mesmaCidade || a.domicilio || a.espaco)) return false;
  if (!capacidadeAtende(c, crit.convidados)) return false;
  if (disponibilidade(c, crit.data) === 'indisponivel') return false;
  return true;
}

/** Filtros secundários escolhidos na lateral. */
export function passaFiltros(c: CandidatoBusca, crit: Criterios, cidade: CidadeBusca | null): boolean {
  if (crit.servicos.length && !crit.servicos.some((s) => c.tiposServico.includes(s))) return false;
  if (crit.restricoes.length && !crit.restricoes.every((r) => c.restricoes.includes(r))) return false;
  if (crit.avaliacao != null && (c.notaMedia == null || c.notaMedia < crit.avaliacao)) return false;
  if (crit.raio != null && cidade && (c.distanciaKm == null || c.distanciaKm > crit.raio)) return false;
  if (crit.local) {
    const a = atendimento(c, cidade, crit.raio);
    if (crit.local === 'domicilio' && !a.domicilio) return false;
    if (crit.local === 'espaco' && !a.espaco) return false;
  }
  return true;
}

// Ranking da busca (rankeamento.md): relevância igual para todos (distância, avaliação, completude, resposta e atividade
// recente) + bônus dosado do pagante (busca_prioridade), vagas de destaque no topo da primeira página, no máximo N
// pagantes seguidos na lista comum e rodízio diário entre empatados. Puro, com pesos e regras configuráveis
// (BUSCA_RANKING_PESOS e BUSCA_RANKING_REGRAS) e testes.
import type { Ordem } from './filtros';

export interface Pesos {
  distancia: number;
  avaliacao: number;
  completude: number;
  resposta: number;
  atividade: number;
}

export const PESOS_PADRAO: Pesos = { distancia: 0.3, avaliacao: 0.25, completude: 0.2, resposta: 0.15, atividade: 0.1 };
/** Quantas avaliações dão confiança total à nota (abaixo disso, a nota pesa proporcionalmente). */
export const AVALIACOES_CONFIANCA = 10;
export const RAIO_REFERENCIA_KM = 30;
/** Atividade recente: 1 no dia, cai linearmente até 0 nesse número de dias. */
export const DIAS_ATIVIDADE = 90;

export interface Regras {
  /** Bônus máximo do pagante, somado à relevância (faixa de teste 0,10 a 0,25) */
  bonusPago: number;
  /** Posições do topo da primeira página reservadas a pagantes relevantes */
  vagasDestaque: number;
  /** Relevância mínima (sem o bônus) para concorrer a uma vaga de destaque */
  relevanciaMinimaDestaque: number;
  /** Máximo de pagantes seguidos na lista comum (fora das vagas de destaque) */
  maxPagosSeguidos: number;
  /** Diferença de pontuação abaixo da qual os resultados entram no rodízio */
  empate: number;
}

export const REGRAS_PADRAO: Regras = { bonusPago: 0.15, vagasDestaque: 3, relevanciaMinimaDestaque: 0.4, maxPagosSeguidos: 3, empate: 0.03 };

export interface Rankeavel {
  id: string;
  nome: string;
  /** Recurso busca_prioridade do plano (Perfil Personalizado) */
  prioridade: boolean;
  completude: number; // 0..100
  notaMedia: number | null; // 1..5
  totalAvaliacoes: number;
  taxaResposta: number | null; // 0..1
  distanciaKm: number | null;
  /** Raio de atendimento em domicílio (km); sem raio vale o de referência */
  raioKm?: number | null;
  /** Última atualização do perfil ou último pedido respondido */
  atividadeEm?: Date | string | null;
}

export interface OpcoesRanking {
  pesos?: Pesos;
  regras?: Regras;
  raioRef?: number;
  /** "Agora" (testes); padrão: new Date() */
  hoje?: Date;
  /** Semente do rodízio (dia + cidade + tipo); sem semente, desempate fixo */
  semente?: string | null;
  /** Tamanho da página do "Mostrar mais" (a regra de pagantes seguidos recomeça a cada página) */
  porPagina?: number;
}

/** Pesos do ambiente (JSON parcial) normalizados para somar 1; inválido → padrão. */
export function lerPesos(json: string | undefined | null): Pesos {
  if (!json) return PESOS_PADRAO;
  try {
    const p = { ...PESOS_PADRAO, ...JSON.parse(json) } as Pesos;
    const chaves = Object.keys(PESOS_PADRAO) as (keyof Pesos)[];
    if (chaves.some((k) => typeof p[k] !== 'number' || !Number.isFinite(p[k]) || p[k] < 0)) return PESOS_PADRAO;
    const soma = chaves.reduce((a, k) => a + p[k], 0);
    if (soma <= 0) return PESOS_PADRAO;
    return Object.fromEntries(chaves.map((k) => [k, p[k] / soma])) as unknown as Pesos;
  } catch {
    return PESOS_PADRAO;
  }
}

// Chaves aceitas em BUSCA_RANKING_REGRAS (snake_case, como em rankeamento.md) e a faixa válida de cada uma
const CHAVES_REGRAS: Record<string, { campo: keyof Regras; min: number; max: number; inteiro?: boolean }> = {
  bonus_pago: { campo: 'bonusPago', min: 0, max: 1 },
  vagas_destaque: { campo: 'vagasDestaque', min: 0, max: 12, inteiro: true },
  relevancia_minima_destaque: { campo: 'relevanciaMinimaDestaque', min: 0, max: 1 },
  max_pagos_seguidos: { campo: 'maxPagosSeguidos', min: 1, max: 100, inteiro: true },
  empate: { campo: 'empate', min: 0, max: 0.2 },
};

/** Regras do ambiente (JSON parcial em snake_case); valor fora da faixa é ignorado. */
export function lerRegras(json: string | undefined | null): Regras {
  if (!json) return REGRAS_PADRAO;
  try {
    const bruto = JSON.parse(json) as Record<string, unknown>;
    const r = { ...REGRAS_PADRAO };
    for (const [chave, v] of Object.entries(bruto)) {
      const def = CHAVES_REGRAS[chave];
      if (!def || typeof v !== 'number' || !Number.isFinite(v) || v < def.min || v > def.max) continue;
      r[def.campo] = def.inteiro ? Math.round(v) : v;
    }
    return r;
  } catch {
    return REGRAS_PADRAO;
  }
}

const limitar = (v: number) => Math.min(Math.max(v, 0), 1);

/** Fatores de 0 a 1 de cada critério. */
export function fatores(r: Rankeavel, raioRef = RAIO_REFERENCIA_KM, hoje = new Date()) {
  const completude = Math.min(Math.max(r.completude, 0), 100) / 100;
  const avaliacao = r.notaMedia ? (r.notaMedia / 5) * Math.min(1, r.totalAvaliacoes / AVALIACOES_CONFIANCA) : 0;
  const resposta = r.taxaResposta == null ? 0.5 : limitar(r.taxaResposta);
  const distancia = r.distanciaKm == null ? 0.5 : 1 - Math.min(r.distanciaKm, raioRef) / raioRef;
  let atividade = 0;
  if (r.atividadeEm) {
    const dias = (hoje.getTime() - new Date(r.atividadeEm).getTime()) / 86_400_000;
    atividade = Number.isFinite(dias) ? limitar(1 - Math.max(dias, 0) / DIAS_ATIVIDADE) : 0;
  }
  return { distancia, avaliacao, completude, resposta, atividade };
}

/** Relevância (0 a 1), igual para pagantes e gratuitos. */
export function pontuar(r: Rankeavel, pesos: Pesos = PESOS_PADRAO, raioRef = RAIO_REFERENCIA_KM, hoje = new Date()): number {
  const f = fatores(r, raioRef, hoje);
  return (Object.keys(pesos) as (keyof Pesos)[]).reduce((s, k) => s + pesos[k] * f[k], 0);
}

/**
 * Bônus do pagante: cheio só com perfil completo e dentro do raio de atendimento; cai linearmente até 0 em 2× o raio.
 * Gratuito: 0.
 */
export function bonusPago(r: Rankeavel, regras: Regras = REGRAS_PADRAO, raioRef = RAIO_REFERENCIA_KM): number {
  if (!r.prioridade) return 0;
  const qualidade = Math.min(Math.max(r.completude, 0), 100) / 100;
  const raio = r.raioKm && r.raioKm > 0 ? r.raioKm : raioRef;
  const d = r.distanciaKm;
  const distancia = d == null || d <= raio ? 1 : limitar(1 - (d - raio) / raio);
  return regras.bonusPago * qualidade * distancia;
}

/** Hash FNV-1a de 32 bits (rodízio estável para a mesma semente). */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Semente do rodízio: dia no fuso de São Paulo + cidade + tipo (igual para todos os visitantes no mesmo dia). */
export function sementeDoDia(cidade: string | null, tipo: string | null, hoje = new Date()): string {
  const dia = hoje.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return `${dia}|${cidade ?? ''}|${tipo ?? ''}`;
}

const nulosNoFim = (a: number | null, b: number | null, asc: boolean) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return asc ? a - b : b - a;
};

export type Classificado<T> = T & { destaque: boolean };

/**
 * Ordena os resultados. "Relevância": pontuação final (relevância + bônus) com rodízio entre empatados, vagas de
 * destaque no topo da primeira página e no máximo `maxPagosSeguidos` pagantes seguidos na lista comum (a contagem
 * recomeça a cada página). "Melhor avaliados" e "Mais próximos" ignoram bônus e destaques e ordenam só pelo critério
 * (empate: pontuação final). Desempate final: mais avaliações, depois nome.
 */
export function ordenar<T extends Rankeavel>(lista: T[], ordem: Ordem = 'relevancia', opcoes: OpcoesRanking = {}): Classificado<T>[] {
  const { pesos = PESOS_PADRAO, regras = REGRAS_PADRAO, raioRef = RAIO_REFERENCIA_KM, hoje = new Date(), semente = null, porPagina = 12 } = opcoes;
  const relevancia = new Map(lista.map((r) => [r.id, pontuar(r, pesos, raioRef, hoje)]));
  const final = new Map(lista.map((r) => [r.id, relevancia.get(r.id)! + bonusPago(r, regras, raioRef)]));
  const desempate = (a: T, b: T) => b.totalAvaliacoes - a.totalAvaliacoes || a.nome.localeCompare(b.nome, 'pt-BR');
  const porFinal = (a: T, b: T) => {
    const d = final.get(b.id)! - final.get(a.id)!;
    return Math.abs(d) > 1e-12 ? d : desempate(a, b);
  };
  const sem = (x: T): Classificado<T> => ({ ...x, destaque: false });

  if (ordem === 'avaliacao' || ordem === 'distancia') {
    return [...lista]
      .sort((a, b) => {
        const d = ordem === 'avaliacao'
          ? nulosNoFim(a.notaMedia, b.notaMedia, false) || b.totalAvaliacoes - a.totalAvaliacoes
          : nulosNoFim(a.distanciaKm, b.distanciaKm, true);
        return d !== 0 ? d : porFinal(a, b);
      })
      .map(sem);
  }

  // Pontuação final; empatados (diferença < empate a partir do primeiro do bloco) em rodízio pela semente
  let ordenados = [...lista].sort(porFinal);
  if (semente) {
    const saida: T[] = [];
    for (let i = 0; i < ordenados.length; ) {
      const topo = final.get(ordenados[i].id)!;
      let j = i + 1;
      while (j < ordenados.length && topo - final.get(ordenados[j].id)! < regras.empate) j++;
      const bloco = ordenados.slice(i, j);
      bloco.sort((a, b) => hash(`${semente}|${a.id}`) - hash(`${semente}|${b.id}`) || desempate(a, b));
      saida.push(...bloco);
      i = j;
    }
    ordenados = saida;
  }

  // Vagas de destaque: pagantes com relevância mínima (sem o bônus), na ordem da pontuação final
  const destaques = ordenados
    .filter((r) => r.prioridade && relevancia.get(r.id)! >= regras.relevanciaMinimaDestaque)
    .slice(0, regras.vagasDestaque);
  const ids = new Set(destaques.map((r) => r.id));
  const resto = ordenados.filter((r) => !ids.has(r.id));

  // Lista comum: no máximo N pagantes seguidos; ao atingir, entra o próximo gratuito (se houver)
  const resultado: Classificado<T>[] = destaques.map((r) => ({ ...r, destaque: true }));
  let seguidos = 0;
  while (resto.length) {
    if (resultado.length % porPagina === 0) seguidos = 0;
    let i = 0;
    if (resto[0].prioridade && seguidos >= regras.maxPagosSeguidos) {
      const g = resto.findIndex((r) => !r.prioridade);
      if (g >= 0) i = g;
    }
    const [r] = resto.splice(i, 1);
    seguidos = r.prioridade ? seguidos + 1 : 0;
    resultado.push(sem(r));
  }
  return resultado;
}

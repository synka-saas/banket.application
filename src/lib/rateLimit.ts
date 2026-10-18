// Limite simples de requisições em memória (janela fixa por chave). Suficiente para uma instância;
// com várias réplicas, trocar por um contador compartilhado (Redis/Postgres).
//
// As chaves ficam separadas por grupo (o prefixo antes do primeiro ":", ex.: "login", "metrica") e cada entrada
// guarda a própria janela. Assim encher um grupo (muitas chaves de métrica, por exemplo) só descarta entradas
// daquele grupo e nunca zera os contadores de outro, como os de login.

type Janela = { inicio: number; total: number; janelaMs: number };

const MAX_POR_GRUPO = 20_000;
const grupos = new Map<string, Map<string, Janela>>();

function grupoDe(chave: string): Map<string, Janela> {
  const nome = chave.slice(0, Math.max(chave.indexOf(':'), 0)) || chave;
  let g = grupos.get(nome);
  if (!g) grupos.set(nome, (g = new Map()));
  return g;
}

/** Registra uma tentativa e informa se ainda está dentro do limite. */
export function permitir(chave: string, limite: number, janelaMs: number, agora = Date.now()): boolean {
  const g = grupoDe(chave);
  const atual = g.get(chave);
  if (!atual || agora - atual.inicio >= atual.janelaMs) {
    // delete + set: a entrada nova vai para o fim da ordem de inserção (as mais antigas saem primeiro)
    g.delete(chave);
    g.set(chave, { inicio: agora, total: 1, janelaMs });
    if (g.size > MAX_POR_GRUPO) limpar(g, agora);
    return true;
  }
  atual.total += 1;
  return atual.total <= limite;
}

/** Tira do grupo as entradas vencidas (cada uma pela sua janela); se ainda passar do teto, as mais antigas. */
function limpar(g: Map<string, Janela>, agora: number) {
  for (const [chave, j] of g) if (agora - j.inicio >= j.janelaMs) g.delete(chave);
  const alvo = Math.floor(MAX_POR_GRUPO * 0.9);
  if (g.size <= alvo) return;
  for (const chave of g.keys()) {
    g.delete(chave);
    if (g.size <= alvo) break;
  }
}

/**
 * IP do cliente. Atrás do Nginx (DEPLOY.md), X-Real-IP traz o endereço da conexão; o Nginx também o acrescenta
 * ao FIM do X-Forwarded-For. Os primeiros itens do X-Forwarded-For vêm do próprio cliente e podem ser forjados,
 * por isso nunca são usados para limitar tentativas.
 */
export function ipDaRequisicao(request: Request, clientAddress?: string): string {
  const real = request.headers.get('x-real-ip')?.trim();
  const ultimoEncaminhado = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return (real || ultimoEncaminhado || clientAddress || 'desconhecido').slice(0, 64);
}

/** Consulta sem registrar: a chave já atingiu o limite na janela atual? (ex.: falhas de login) */
export function excedeu(chave: string, limite: number, janelaMs: number, agora = Date.now()): boolean {
  const atual = grupoDe(chave).get(chave);
  return Boolean(atual && agora - atual.inicio < janelaMs && atual.total >= limite);
}

/** Zera a contagem de uma chave (ex.: login bem-sucedido). */
export function zerar(chave: string) {
  grupoDe(chave).delete(chave);
}

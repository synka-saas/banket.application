// Limite simples de requisições em memória (janela fixa por chave). Suficiente para uma instância;
// com várias réplicas, trocar por um contador compartilhado (Redis/Postgres).

const janelas = new Map<string, { inicio: number; total: number }>();

/** Registra uma tentativa e informa se ainda está dentro do limite. */
export function permitir(chave: string, limite: number, janelaMs: number, agora = Date.now()): boolean {
  const atual = janelas.get(chave);
  if (!atual || agora - atual.inicio >= janelaMs) {
    janelas.set(chave, { inicio: agora, total: 1 });
    if (janelas.size > 10_000) limpar(janelaMs, agora);
    return true;
  }
  atual.total += 1;
  return atual.total <= limite;
}

function limpar(janelaMs: number, agora: number) {
  for (const [chave, j] of janelas) if (agora - j.inicio >= janelaMs) janelas.delete(chave);
}

/** IP do cliente (primeiro endereço do X-Forwarded-For quando atrás de proxy). */
export function ipDaRequisicao(request: Request, clientAddress?: string): string {
  const encaminhado = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (encaminhado || clientAddress || 'desconhecido').slice(0, 64);
}

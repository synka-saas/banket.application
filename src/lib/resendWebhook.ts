// Verificação da assinatura dos webhooks do Resend (padrão Svix), sem dependência externa.
// Conteúdo assinado: "<svix-id>.<svix-timestamp>.<corpo bruto>"; chave = base64 do segredo após "whsec_";
// HMAC-SHA256 em base64; o cabeçalho svix-signature traz uma ou mais assinaturas "v1,<base64>" separadas por espaço.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface CabecalhosSvix {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export const TOLERANCIA_PADRAO_S = 5 * 60;

export function assinarSvix(id: string, timestamp: string, rawBody: string, secret: string): string {
  const chave = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return createHmac('sha256', chave).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
}

/** true quando alguma assinatura v1 do cabeçalho confere e o timestamp está dentro da tolerância. */
export function verificarAssinaturaSvix(
  rawBody: string,
  cabecalhos: CabecalhosSvix,
  secret: string,
  agora: number = Date.now(),
  toleranciaS: number = TOLERANCIA_PADRAO_S
): boolean {
  const { id, timestamp, signature } = cabecalhos;
  if (!id || !timestamp || !signature || !secret) return false;
  if (!/^\d+$/.test(timestamp)) return false;
  const segundos = Number(timestamp);
  if (Math.abs(agora / 1000 - segundos) > toleranciaS) return false;

  const esperada = Buffer.from(assinarSvix(id, timestamp, rawBody, secret));
  return signature
    .split(/\s+/)
    .filter(Boolean)
    .some((parte) => {
      const [versao, valor] = parte.split(',', 2);
      if (versao !== 'v1' || !valor) return false;
      const recebida = Buffer.from(valor);
      return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
    });
}

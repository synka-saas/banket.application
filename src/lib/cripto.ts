// Cifra simétrica (AES-256-GCM) para segredos guardados no banco, como os tokens OAuth do Google.
// A chave é derivada do JWT_SECRET: trocar o segredo invalida os tokens guardados (as contas precisam reconectar).
import crypto from 'node:crypto';

function chave(): Buffer {
  const s = process.env.JWT_SECRET ?? (import.meta.env as Record<string, string | undefined>).JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET ausente');
  return crypto.createHash('sha256').update(`cripto:${s}`).digest();
}

/** texto → "v1.<iv>.<tag>.<dados>" em base64url */
export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), dados.toString('base64url')].join('.');
}

/** Devolve null quando o valor não foi cifrado por esta chave (segredo trocado ou dado corrompido). */
export function decifrar(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const [versao, iv, tag, dados] = valor.split('.');
  if (versao !== 'v1' || !iv || !tag || !dados) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dados, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

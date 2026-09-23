import crypto from 'node:crypto';

/** Token aleatório para links de uso único (convite, verificação, redefinição de senha). */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** Só o hash é persistido: um vazamento do banco não expõe links válidos. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

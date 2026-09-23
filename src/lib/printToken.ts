// Token de curta duração para o Chromium interno abrir as páginas de impressão (/print/*),
// que ficam fora da sessão do usuário. Vale só para o recurso e o tenant indicados.
import { SignJWT, jwtVerify } from 'jose';

export interface PrintClaims {
  tenantId: string;
  alvo: 'versao' | 'template';
  id: string;
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET ?? (import.meta.env as Record<string, string | undefined>).JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET ausente');
  return new TextEncoder().encode(`print:${s}`);
}

export async function signPrintToken(claims: PrintClaims): Promise<string> {
  return new SignJWT({ tenant_id: claims.tenantId, alvo: claims.alvo, recurso: claims.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret());
}

export async function verifyPrintToken(token: string | null, alvo: PrintClaims['alvo'], id: string): Promise<PrintClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.alvo !== alvo || payload.recurso !== id || typeof payload.tenant_id !== 'string') return null;
    return { tenantId: payload.tenant_id, alvo, id };
  } catch {
    return null;
  }
}

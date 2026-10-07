// Google: login (OpenID Connect) e agenda (Calendar API com sala do Google Meet), só com fetch.
// Configuração: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (cliente OAuth "Aplicativo da Web" com a API Google Calendar
// ativada) e a URI de redirecionamento GOOGLE_REDIRECT_URI (padrão: APP_URL + /auth/google/callback).
import { SignJWT, jwtVerify } from 'jose';
import { appUrl } from './mail';

function env(name: string): string | undefined {
  const v = process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
  return v?.trim() || undefined;
}

export const ESCOPO_AGENDA = 'https://www.googleapis.com/auth/calendar.events';
const ESCOPOS_LOGIN = ['openid', 'email', 'profile'];

export function googleConfigurado(): boolean {
  return Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET'));
}

export function redirectUriGoogle(): string {
  return env('GOOGLE_REDIRECT_URI') ?? appUrl('/auth/google/callback');
}

function credenciais(): { clientId: string; clientSecret: string } {
  const clientId = env('GOOGLE_CLIENT_ID');
  const clientSecret = env('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Login com o Google não configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
  return { clientId, clientSecret };
}

// ---------------------------------------------------------------------------
// State assinado do fluxo OAuth (10 min): modo, usuário (ao vincular), destino e um nonce que também vai
// num cookie, para o callback só aceitar o retorno do navegador que iniciou o fluxo (evita login CSRF).
// ---------------------------------------------------------------------------
export interface EstadoOAuth {
  modo: 'login' | 'vincular';
  usuarioId?: string;
  next?: string;
  nonce: string;
}

function segredoEstado(): Uint8Array {
  const s = env('JWT_SECRET');
  if (!s) throw new Error('JWT_SECRET ausente');
  return new TextEncoder().encode(`google-oauth:${s}`);
}

export async function assinarEstado(estado: EstadoOAuth): Promise<string> {
  return new SignJWT({ ...estado, purpose: 'google_oauth' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(segredoEstado());
}

export async function verificarEstado(token: string | null): Promise<EstadoOAuth | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredoEstado());
    if (payload.purpose !== 'google_oauth' || typeof payload.nonce !== 'string') return null;
    if (payload.modo !== 'login' && payload.modo !== 'vincular') return null;
    return {
      modo: payload.modo,
      usuarioId: typeof payload.usuarioId === 'string' ? payload.usuarioId : undefined,
      next: typeof payload.next === 'string' ? payload.next : undefined,
      nonce: payload.nonce,
    };
  } catch {
    return null;
  }
}

/**
 * URL de autorização. O login já pede o escopo da agenda (acesso offline) para ativar o agendamento de reuniões;
 * `forcarConsentimento` garante um refresh token novo quando o guardado foi perdido/revogado.
 */
export function urlAutorizacao(state: string, opcoes: { forcarConsentimento?: boolean; loginHint?: string } = {}): string {
  const { clientId } = credenciais();
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUriGoogle(),
    response_type: 'code',
    scope: [...ESCOPOS_LOGIN, ESCOPO_AGENDA].join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: opcoes.forcarConsentimento ? 'consent' : 'select_account',
    state,
  });
  if (opcoes.loginHint) p.set('login_hint', opcoes.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export interface TokensGoogle {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codigo?: string
  ) {
    super(message);
  }
}

async function chamarToken(body: Record<string, string>): Promise<TokensGoogle> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokensGoogle> & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new GoogleApiError(json.error_description ?? json.error ?? `Falha ao obter token do Google (${res.status})`, res.status, json.error);
  }
  return json as TokensGoogle;
}

export function trocarCodigo(code: string): Promise<TokensGoogle> {
  const { clientId, clientSecret } = credenciais();
  return chamarToken({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUriGoogle(), grant_type: 'authorization_code' });
}

export function renovarAccessToken(refreshToken: string): Promise<TokensGoogle> {
  const { clientId, clientSecret } = credenciais();
  return chamarToken({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' });
}

/** Revoga o token no Google (melhor esforço: o desvínculo local acontece de qualquer forma). */
export async function revogarToken(token: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' });
  } catch {
    // ignorado
  }
}

export interface PerfilGoogle {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string | null;
  picture: string | null;
}

export async function perfilGoogle(accessToken: string): Promise<PerfilGoogle> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new GoogleApiError(`Falha ao ler o perfil do Google (${res.status})`, res.status);
  const j = (await res.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
  if (!j.sub || !j.email) throw new GoogleApiError('O Google não devolveu o e-mail da conta.', 400);
  return { sub: j.sub, email: j.email.toLowerCase(), email_verified: Boolean(j.email_verified), name: j.name ?? null, picture: j.picture ?? null };
}

export const temEscopoAgenda = (scope: string | null | undefined) => (scope ?? '').split(/\s+/).includes(ESCOPO_AGENDA);

// ---------------------------------------------------------------------------
// Calendar API: evento na agenda principal do usuário, com sala do Google Meet e convites aos participantes
// ---------------------------------------------------------------------------
export const FUSO_AGENDA = 'America/Sao_Paulo';

export interface DadosEventoAgenda {
  titulo: string;
  descricao: string | null;
  local: string | null;
  /** "YYYY-MM-DDTHH:MM:SS" no fuso de São Paulo */
  inicio: string;
  fim: string;
  participantes: string[];
}

export interface EventoAgendaCriado {
  id: string;
  htmlLink: string | null;
  meetLink: string | null;
}

const BASE_CALENDAR = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

function corpoEvento(d: DadosEventoAgenda) {
  return {
    summary: d.titulo,
    description: d.descricao ?? undefined,
    location: d.local ?? undefined,
    start: { dateTime: d.inicio, timeZone: FUSO_AGENDA },
    end: { dateTime: d.fim, timeZone: FUSO_AGENDA },
    attendees: d.participantes.map((email) => ({ email })),
    reminders: { useDefault: true },
  };
}

async function chamarCalendar(accessToken: string, url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  if (!res.ok) {
    const detalhe = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    throw new GoogleApiError(detalhe.error?.message ?? `Google Calendar respondeu ${res.status}`, res.status, detalhe.error?.status);
  }
  return res;
}

function lerEvento(j: { id: string; htmlLink?: string; hangoutLink?: string; conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] } }): EventoAgendaCriado {
  const meet = j.hangoutLink ?? j.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ?? null;
  return { id: j.id, htmlLink: j.htmlLink ?? null, meetLink: meet };
}

export async function criarEventoAgenda(accessToken: string, d: DadosEventoAgenda, requestId: string): Promise<EventoAgendaCriado> {
  const res = await chamarCalendar(accessToken, `${BASE_CALENDAR}?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST',
    body: JSON.stringify({ ...corpoEvento(d), conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } } }),
  });
  return lerEvento(await res.json());
}

export async function atualizarEventoAgenda(accessToken: string, eventId: string, d: DadosEventoAgenda): Promise<EventoAgendaCriado> {
  const res = await chamarCalendar(accessToken, `${BASE_CALENDAR}/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'PATCH',
    body: JSON.stringify(corpoEvento(d)),
  });
  return lerEvento(await res.json());
}

/** Remove o evento da agenda (e avisa os participantes). Evento já apagado conta como sucesso. */
export async function excluirEventoAgenda(accessToken: string, eventId: string): Promise<void> {
  try {
    await chamarCalendar(accessToken, `${BASE_CALENDAR}/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof GoogleApiError && (err.status === 404 || err.status === 410)) return;
    throw err;
  }
}

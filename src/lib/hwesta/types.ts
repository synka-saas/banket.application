// HCP v1 — tipos do contrato. NÃO editar por app: o que muda por app é só o adapter.ts.
export type HwestaAccountStatus = 'active' | 'trial' | 'past_due' | 'suspended' | 'canceled';
export type HwestaUserStatus = 'active' | 'inactive' | 'pending';
export type HwestaCapabilityValue = string | number | boolean | null;

export interface HwestaCapabilities {
  accounts: boolean;
  users: boolean;
  plans_catalog: boolean;
  entitlements_push: boolean;
  kill_switch: boolean;
  users_status: boolean;
  users_reset_password: boolean;
  events: boolean;
  tickets: boolean;
}

export interface HwestaPlan {
  id: string;
  slug: string;
  name: string;
  price: number;
  billing_cycle: 'monthly' | 'yearly' | 'lifetime';
  is_active: boolean;
  capabilities: Record<string, HwestaCapabilityValue>;
}

export interface HwestaAccount {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  status: HwestaAccountStatus;
  is_active: boolean;
  plan_slug: string | null;
  plan_name: string | null;
  user_count: number;
  created_at: string | null;
  updated_at: string | null;
  extra?: Record<string, unknown>;
}

export interface HwestaUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: HwestaUserStatus;
  last_login_at: string | null;
  created_at: string | null;
}

export interface HwestaEntitlements {
  plan_slug: string | null;
  plan_name: string | null;
  status: HwestaAccountStatus;
  capabilities: Record<string, HwestaCapabilityValue>;
  expires_at: string | null;
  source?: string;
  pushed_at?: string;
}

export interface HwestaEvent {
  id: string;
  type: string;
  occurred_at: string;
  data: Record<string, any>;
}

/**
 * Regra de negócio do app que impede a operação pedida pelo Manager (ex.: desativar o único proprietário).
 * Lançada pelo adapter; os handlers respondem { error: message } com o status informado, em vez de 500.
 */
export class HwestaError extends Error {
  constructor(
    message: string,
    readonly status = 409
  ) {
    super(message);
  }
}

/** Quem está logado no app, para abrir/consultar chamados. */
export interface HwestaRequester {
  userId: string;
  accountId: string;
  name: string | null;
  email: string | null;
  planSlug?: string | null;
}

export interface ListAccountsQuery {
  page: number;
  perPage: number;
  updatedSince?: string | null;
  q?: string | null;
}

/**
 * Único ponto que conhece o banco/modelo do app. Tudo o mais em src/lib/hwesta é genérico.
 * Métodos opcionais só precisam existir se a capability correspondente for true.
 */
export interface HwestaAdapter {
  appId: string;
  name: string;
  version: string;
  capabilities: HwestaCapabilities;

  listPlans(): Promise<HwestaPlan[]>;
  listAccounts(q: ListAccountsQuery): Promise<{ data: HwestaAccount[]; total: number }>;
  getAccount(id: string): Promise<HwestaAccount | null>;
  listUsers(accountId: string): Promise<HwestaUser[]>;

  /** Deve derrubar as sessões da conta (o middleware do app checa status a cada request). */
  setAccountStatus(id: string, status: 'active' | 'suspended' | 'canceled', reason: string | null): Promise<HwestaAccount | null>;

  applyEntitlements(accountId: string, ent: HwestaEntitlements): Promise<boolean>;
  getEntitlements(accountId: string): Promise<HwestaEntitlements | null>;

  setUserStatus?(accountId: string, userId: string, status: 'active' | 'inactive'): Promise<HwestaUser | null>;
  resetUserPassword?(accountId: string, userId: string): Promise<boolean>;

  /** Grava o evento recebido. Retorna false se o id já existia (entrega repetida). */
  recordEvent(event: HwestaEvent): Promise<boolean>;
  /** Reação do app ao evento (notificar usuário, invalidar cache...). Erros são logados, não propagados. */
  onEvent?(event: HwestaEvent): Promise<void>;

  /** Resolve usuário/conta da sessão atual (locals do middleware do app). null = não autenticado. */
  resolveRequester(context: { locals: any; cookies: any; request: Request }): Promise<HwestaRequester | null> | HwestaRequester | null;
}

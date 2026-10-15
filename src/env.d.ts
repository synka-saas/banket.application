/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Usuário autenticado (definido pelo middleware nas rotas protegidas). */
    user: import('./lib/auth').SessionUser;
    /** Mensagem de feedback vinda de um redirect anterior. */
    flash: import('./lib/flash').Flash | null;
    /** Plano e recursos da empresa da sessão (lib/planos/gating), definido pelo middleware nas rotas protegidas. */
    plano: import('./lib/planos/gating').Entitlements | null;
  }
}

// HCP v1 — ponto de entrada. As rotas em src/pages/api/hwesta/v1 e src/pages/api/suporte importam daqui.
import adapter from './adapter';
import { createHwestaHandlers } from './handlers';
import { createSupportHandlers } from './support';

export const handlers = createHwestaHandlers(adapter);
export const support = createSupportHandlers(adapter);
export { adapter };
export { can, limit, withinLimit, getEntitlements, invalidateEntitlements } from './entitlements';
export { tickets, managerFetch } from './client';
export type * from './types';

import { jsonEndpoint, readJson } from '../../../lib/api';
import { withTenant } from '../../../lib/db';
import { setFlash } from '../../../lib/flash';
import { UserError } from '../../../lib/forms';
import {
  carregarFormulario,
  duplicarFormulario,
  excluirFormulario,
  formularioSchema,
  salvarFormulario,
} from '../../../server/formularios';

export const GET = jsonEndpoint(async ({ params, locals }) => {
  const formulario = await withTenant(locals.user.tenantId, (db) => carregarFormulario(db, params.id!));
  if (!formulario) throw new UserError('Formulário não encontrado.');
  return formulario;
});

export const PUT = jsonEndpoint(async ({ params, request, locals, cookies }) => {
  const input = formularioSchema.parse(await readJson(request));
  await withTenant(locals.user.tenantId, (db) => salvarFormulario(db, params.id!, input));
  setFlash(cookies, 'success', 'Formulário salvo.');
  return { id: params.id };
});

export const DELETE = jsonEndpoint(async ({ params, locals, cookies }) => {
  await withTenant(locals.user.tenantId, (db) => excluirFormulario(db, params.id!));
  setFlash(cookies, 'success', 'Formulário removido.');
  return { ok: true };
});

// Duplica o formulário (POST /api/formularios/:id); a cópia nasce inativa
export const POST = jsonEndpoint(async ({ params, locals, cookies }) => {
  const { tenantId } = locals.user;
  const id = await withTenant(tenantId, (db) => duplicarFormulario(db, tenantId, params.id!));
  setFlash(cookies, 'success', 'Formulário duplicado. A cópia está inativa até você ativá-la.');
  return { id };
});

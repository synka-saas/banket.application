import type { APIRoute } from 'astro';
import { jsonEndpoint } from '../../../../lib/api';
import { pixDaFatura, situacaoDaFatura } from '../../../../server/assinatura';

// Pix de uma fatura da assinatura. POST gera (ou reaproveita) o QR Code; GET devolve a situação da fatura.
export const POST: APIRoute = jsonEndpoint(async ({ params, locals }) => pixDaFatura(locals.user, String(params.fatura ?? '')));
export const GET: APIRoute = jsonEndpoint(async ({ params, locals }) => situacaoDaFatura(locals.user, String(params.fatura ?? '')));

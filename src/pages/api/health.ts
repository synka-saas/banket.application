import type { APIRoute } from 'astro';
import { systemQuery } from '../../lib/db';

export const GET: APIRoute = async () => {
  try {
    await systemQuery('SELECT 1');
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'erro', banco: 'indisponível' }, { status: 503 });
  }
};

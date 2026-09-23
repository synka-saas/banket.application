import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../lib/auth';

export const GET: APIRoute = ({ cookies, redirect }) => {
  clearSessionCookie(cookies);
  return redirect('/auth/login');
};

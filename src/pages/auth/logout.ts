import type { APIRoute } from 'astro';
import { clearOnboardingCookie, clearSessionCookie } from '../../lib/auth';

export const GET: APIRoute = ({ cookies, redirect }) => {
  clearSessionCookie(cookies);
  clearOnboardingCookie(cookies);
  return redirect('/auth/login');
};

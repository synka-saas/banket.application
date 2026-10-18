import type { APIRoute } from 'astro';
import { lerTokenSessao } from '../../../lib/auth';
import { conferirSessao } from '../../../lib/membership';

// Verificação de sessão da Central de Ajuda (app.banket.com.br/ajuda/, site estático em help/).
// O Nginx do host chama esta rota por auth_request antes de servir qualquer arquivo da ajuda e guarda o "sim" por 30 s.
// Mesma regra do middleware (conferirSessao), sem corpo: 200 = pode ler; 401 = sem sessão válida (vai para o login);
// 403 = empresa suspensa (vai para /conta-suspensa, como no app). Vale para todos os planos, inclusive o gratuito.
// 200 e não 204: o proxy_cache do Nginx só guarda as respostas 200.
export const GET: APIRoute = async ({ cookies }) => {
  const { user, membership } = await conferirSessao(lerTokenSessao(cookies));
  const status = !user ? 401 : membership?.tenantStatus !== 'active' ? 403 : 200;
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
};

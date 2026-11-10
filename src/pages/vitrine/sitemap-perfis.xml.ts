import type { APIRoute } from 'astro';
import { buscaUrl } from '../../lib/busca/url';
import { caminhosPerfisPublicados } from '../../server/busca/locais';
import { respostaSitemap } from '../../server/busca/sitemap';

// As URLs de perfil existentes permanecem iguais, sem barra final ou parâmetros adicionais.
export const GET: APIRoute = async () => respostaSitemap((await caminhosPerfisPublicados()).map(buscaUrl));

import type { APIRoute } from 'astro';
import { buscaUrl } from '../../lib/busca/url';
import { paginasIndexaveis } from '../../server/busca/locais';
import { respostaSitemap } from '../../server/busca/sitemap';

// Páginas de categoria indexáveis (hub, cidade e bairro acima do piso); a que atinge o piso entra sozinha.
export const GET: APIRoute = async () => respostaSitemap((await paginasIndexaveis()).categorias.map((p) => buscaUrl(p.caminho)));

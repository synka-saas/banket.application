import { describe, expect, it } from 'vitest';
import { decidirHost } from './host';

const HV = 'busca.banket.com.br';
const UV = 'https://busca.banket.com.br';

describe('decidirHost', () => {
  it('sem BUSCA_URL (dev) não interfere', () => {
    expect(decidirHost('localhost:4321', '/vitrine/buscar', '', null, null)).toEqual({ acao: 'seguir' });
  });

  it('no host da vitrine, serve as páginas por /vitrine e deixa estáticos e API passarem', () => {
    expect(decidirHost(HV, '/', '', HV, UV)).toEqual({ acao: 'reescrever', caminho: '/vitrine' });
    expect(decidirHost(HV, '/buffet/sabor', '?data=2026-11-14', HV, UV)).toEqual({ acao: 'reescrever', caminho: '/vitrine/buffet/sabor?data=2026-11-14' });
    expect(decidirHost(HV, '/sitemap.xml', '', HV, UV)).toEqual({ acao: 'reescrever', caminho: '/vitrine/sitemap.xml' });
    expect(decidirHost(HV, '/robots.txt', '', HV, UV)).toEqual({ acao: 'reescrever', caminho: '/vitrine/robots.txt' });
    expect(decidirHost(HV, '/dashboard', '', HV, UV)).toEqual({ acao: 'reescrever', caminho: '/vitrine/dashboard' });
    for (const p of ['/_astro/x.js', '/busca-media/t/busca/a.png', '/busca-demo/mesa-1.svg', '/api/vitrine/cidades', '/logo-dark.png', '/fonts/a.woff2']) {
      expect(decidirHost(HV, p, '', HV, UV), p).toEqual({ acao: 'seguir' });
    }
  });

  it('no host da vitrine, /vitrine/... vira a forma limpa', () => {
    expect(decidirHost(HV, '/vitrine/buscar', '?tipo=casamento', HV, UV)).toEqual({ acao: 'redirecionar', url: '/buscar?tipo=casamento' });
    expect(decidirHost(HV, '/vitrine', '', HV, UV)).toEqual({ acao: 'redirecionar', url: '/' });
  });

  it('no host do app, /vitrine redireciona para o subdomínio; o resto segue', () => {
    expect(decidirHost('app.banket.com.br', '/vitrine/buffet/x', '', HV, UV)).toEqual({ acao: 'redirecionar', url: 'https://busca.banket.com.br/buffet/x' });
    expect(decidirHost('app.banket.com.br', '/vitrine', '', HV, UV)).toEqual({ acao: 'redirecionar', url: 'https://busca.banket.com.br/' });
    expect(decidirHost('app.banket.com.br', '/vitrineX', '', HV, UV)).toEqual({ acao: 'seguir' });
    expect(decidirHost('app.banket.com.br', '/dashboard', '', HV, UV)).toEqual({ acao: 'seguir' });
  });
});

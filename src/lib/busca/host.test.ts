import { describe, expect, it } from 'vitest';
import { decidirHost } from './host';

const HV = 'busca.banket.com.br';
const UV = 'https://busca.banket.com.br';
const UA = 'https://app.banket.com.br';
const d = (host: string, path: string, search = '') => decidirHost(host, path, search, HV, UV, UA);

describe('decidirHost', () => {
  it('sem BUSCA_URL (dev) não interfere', () => {
    expect(decidirHost('localhost:4321', '/vitrine/buscar', '', null, null, null)).toEqual({ acao: 'seguir' });
  });

  it('no host do Busca, a vitrine é servida por /vitrine com a URL limpa', () => {
    expect(d(HV, '/')).toEqual({ acao: 'reescrever', caminho: '/vitrine' });
    expect(d(HV, '/buffet/sabor', '?data=2026-11-14')).toEqual({ acao: 'reescrever', caminho: '/vitrine/buffet/sabor?data=2026-11-14' });
    expect(d(HV, '/buffet/casamento/campinas')).toEqual({ acao: 'reescrever', caminho: '/vitrine/buffet/casamento/campinas' });
    expect(d(HV, '/buscar', '?tipo=x')).toEqual({ acao: 'reescrever', caminho: '/vitrine/buscar?tipo=x' });
    expect(d(HV, '/sitemap.xml')).toEqual({ acao: 'reescrever', caminho: '/vitrine/sitemap.xml' });
    expect(d(HV, '/robots.txt')).toEqual({ acao: 'reescrever', caminho: '/vitrine/robots.txt' });
  });

  it('no host do Busca, a área do buffet, a autenticação e os estáticos seguem direto', () => {
    for (const p of ['/busca', '/busca/cadastro', '/planos', '/auth/login', '/auth/cadastro', '/conta', '/suporte', '/api/busca/x', '/api/planos/trial',
      '/api/sessao/empresa', '/_astro/x.js', '/busca-media/t/busca/a.png', '/busca-demo/mesa-1.svg', '/api/vitrine/cidades', '/logo-dark.png', '/uploads/t/x.png']) {
      expect(d(HV, p), p).toEqual({ acao: 'seguir' });
    }
  });

  it('no host do Busca, outras rotas do app vão para o host do app', () => {
    expect(d(HV, '/dashboard')).toEqual({ acao: 'redirecionar', url: 'https://app.banket.com.br/dashboard', status: 302 });
    expect(d(HV, '/eventos/abc', '?x=1')).toEqual({ acao: 'redirecionar', url: 'https://app.banket.com.br/eventos/abc?x=1', status: 302 });
    expect(d(HV, '/buscadores')).toEqual({ acao: 'redirecionar', url: 'https://app.banket.com.br/buscadores', status: 302 });
  });

  it('no host do Busca, /vitrine/... vira a forma limpa', () => {
    expect(d(HV, '/vitrine/buscar', '?tipo=casamento')).toEqual({ acao: 'redirecionar', url: '/buscar?tipo=casamento', status: 301 });
    expect(d(HV, '/vitrine')).toEqual({ acao: 'redirecionar', url: '/', status: 301 });
  });

  it('no host do app, /vitrine redireciona para o Busca; a prévia e o resto seguem', () => {
    expect(d('app.banket.com.br', '/vitrine/buffet/x')).toEqual({ acao: 'redirecionar', url: 'https://busca.banket.com.br/buffet/x', status: 301 });
    expect(d('app.banket.com.br', '/vitrine')).toEqual({ acao: 'redirecionar', url: 'https://busca.banket.com.br/', status: 301 });
    expect(d('app.banket.com.br', '/vitrine/buffet/x', '?previa=1')).toEqual({ acao: 'seguir' });
    expect(d('app.banket.com.br', '/vitrine/buffet/x', '?data=2026-11-14&previa=1')).toEqual({ acao: 'seguir' });
    expect(d('app.banket.com.br', '/vitrineX')).toEqual({ acao: 'seguir' });
    expect(d('app.banket.com.br', '/busca')).toEqual({ acao: 'seguir' });
  });
});

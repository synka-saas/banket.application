import { describe, expect, it } from 'vitest';
import { chipsDosFiltros, dataValida, lerCriterios, queryDaBusca, semFiltrosSecundarios, temFiltrosSecundarios, tipoDaUrl, urlDoTipo } from './filtros';

const HOJE = '2026-10-16';
const ler = (q: string) => lerCriterios(new URLSearchParams(q), HOJE);

describe('lerCriterios', () => {
  it('lê os critérios principais e ignora inválidos', () => {
    const c = ler('tipo=casamento&cidade=Campinas-SP&data=2026-11-14&convidados=120&ordem=distancia&pagina=2');
    expect(c).toMatchObject({ tipo: 'casamento', cidade: 'campinas-sp', data: '2026-11-14', convidados: 120, ordem: 'distancia', pagina: 2 });
    // ordenar por preço saiu (o Busca não divulga preço): cai na relevância
    expect(ler('ordem=preco').ordem).toBe('relevancia');
    expect(ler('tipo=show&cidade=x&data=2026-02-30&convidados=0&ordem=aleatoria&pagina=999')).toMatchObject({
      tipo: null, cidade: null, data: null, convidados: null, ordem: 'relevancia', pagina: 1,
    });
  });

  it('nome do buffet: espaços normalizados, mínimo de 2 caracteres, vai na URL como q', () => {
    expect(ler('q=%20%20Buffet%20%20Mediterr%C3%A2neo%20').nome).toBe('Buffet Mediterrâneo');
    expect(ler('q=a').nome).toBeNull();
    expect(ler('').nome).toBeNull();
    expect(queryDaBusca({ nome: 'Bisutti', cidade: 'sao-paulo-sp' })).toBe('?q=Bisutti&cidade=sao-paulo-sp');
    const chips = chipsDosFiltros(ler('q=Bisutti&raio=10'), { servico: (x) => x, restricao: (x) => x });
    expect(chips.map((c) => c.rotulo)).toEqual(['Nome: Bisutti', 'Até 10 km']);
    expect(chips[0].sem.nome).toBeNull();
  });

  it('data no passado é descartada; aceita dd/mm/aaaa', () => {
    expect(dataValida('2026-10-15', HOJE)).toBeNull();
    expect(dataValida('16/10/2026', HOJE)).toBe('2026-10-16');
    expect(dataValida('31/04/2027', HOJE)).toBeNull();
  });

  it('filtros secundários: múltiplos, notas e raios permitidos', () => {
    const c = ler('servico=churrasco&servico=xyz&servico=finger_food&restricao=vegana&preco_min=150&avaliacao=4.5&raio=25&local=espaco');
    expect(c.servicos).toEqual(['finger_food', 'churrasco']);
    expect(c.restricoes).toEqual(['vegana']);
    expect(c).not.toHaveProperty('precoMin');
    expect([c.avaliacao, c.raio, c.local]).toEqual([4.5, 25, 'espaco']);
    expect(ler('avaliacao=3&raio=7&local=praia')).toMatchObject({ avaliacao: null, raio: null, local: null });
    expect(temFiltrosSecundarios(c)).toBe(true);
    expect(temFiltrosSecundarios(semFiltrosSecundarios(c))).toBe(false);
  });
});

describe('queryDaBusca', () => {
  it('ida e volta preserva os critérios', () => {
    const q = '?tipo=infantil&cidade=santo-andre-sp&convidados=80&servico=kids&ordem=avaliacao';
    expect(queryDaBusca(ler(q.slice(1)))).toBe(q);
    expect(queryDaBusca({})).toBe('');
  });

  it('chips removem um filtro por vez', () => {
    const c = ler('servico=churrasco&local=domicilio&raio=10');
    const chips = chipsDosFiltros(c, { servico: (s) => s.toUpperCase(), restricao: (s) => s });
    expect(chips.map((x) => x.rotulo)).toEqual(['CHURRASCO', 'Em domicílio', 'Até 10 km']);
    expect(chips[0].sem.servicos).toEqual([]);
    expect(chips[1].sem.local).toBeNull();
  });
});

describe('tipos na URL das landings', () => {
  it('converte hífen e sublinhado', () => {
    expect(tipoDaUrl('coffee-break')).toBe('coffee_break');
    expect(tipoDaUrl('casamento')).toBe('casamento');
    expect(tipoDaUrl('show')).toBeNull();
    expect(urlDoTipo('coffee_break')).toBe('coffee-break');
  });
});

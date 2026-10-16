import { describe, expect, it } from 'vitest';
import { cepValido, distanciaKm, formatarDistancia, slugCidade, slugTexto } from './geo';

describe('geo', () => {
  it('calcula a distância entre São Paulo e Campinas (~82 km, como o earthdistance)', () => {
    const d = distanciaKm({ lat: -23.5329, lng: -46.6395 }, { lat: -22.9053, lng: -47.0659 });
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(84);
    expect(distanciaKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });

  it('gera slugs sem acento', () => {
    expect(slugCidade('Santo André', 'SP')).toBe('santo-andre-sp');
    expect(slugCidade("Pau d'Arco", 'TO')).toBe('pau-d-arco-to');
    expect(slugTexto('  Buffet Sabor & Festa!  ')).toBe('buffet-sabor-festa');
    expect(slugTexto('***')).toBe('buffet');
  });

  it('formata distâncias e valida CEP', () => {
    expect(formatarDistancia(0.42)).toBe('400 m');
    expect(formatarDistancia(3.456)).toBe('3,5 km');
    expect(formatarDistancia(23.7)).toBe('24 km');
    expect(formatarDistancia(null)).toBe('');
    expect(cepValido('09030-010')).toBe('09030010');
    expect(cepValido('1234')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { completude, etapasConcluidas, pendentesParaPublicar, podePublicar, proximaEtapa, type EstadoPerfil } from './onboarding';

const vazio: EstadoPerfil = {
  nome: 'Buffet', documento: null, descricao: null, logo_path: null, telefone: null, whatsapp: null, email_contato: null,
  instagram: null, site: null, tipos_evento: [], tipos_servico: [], atende_domicilio: false, raio_km: null, espaco_proprio: false,
  logradouro: null, cidade_id: null, capacidade_min: null, capacidade_max: null, tempo_resposta_texto: null, publicado: false,
};
const completo: EstadoPerfil = {
  ...vazio, documento: '11222333000181', descricao: 'x'.repeat(320), logo_path: 'busca/a.png', whatsapp: '11999999999',
  email_contato: 'a@b.test', instagram: '@buffet', tipos_evento: ['casamento'], tipos_servico: ['buffet_completo'],
  espaco_proprio: true, logradouro: 'Rua A', cidade_id: 1, capacidade_min: 40, capacidade_max: 200, tempo_resposta_texto: 'Em até 2 horas',
};

describe('etapas do onboarding', () => {
  it('perfil novo: só falta tudo e a próxima etapa é a 1', () => {
    expect([...etapasConcluidas(vazio, { fotos: 0 })]).toEqual([]);
    expect(proximaEtapa(vazio, { fotos: 0 })).toBe(1);
    expect(pendentesParaPublicar(vazio, { fotos: 0 }).map((e) => e.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it('cada etapa tem sua regra', () => {
    expect(etapasConcluidas({ ...completo, descricao: 'curta' }, { fotos: 3 }).has(1)).toBe(false);
    expect(etapasConcluidas({ ...completo, whatsapp: null, telefone: '1140000000' }, { fotos: 3 }).has(1)).toBe(true);
    expect(etapasConcluidas({ ...completo, tipos_servico: [] }, { fotos: 3 }).has(2)).toBe(false);
    // região: espaço próprio precisa de endereço; domicílio precisa de raio; os dois precisam da cidade
    expect(etapasConcluidas({ ...completo, logradouro: null }, { fotos: 3 }).has(3)).toBe(false);
    expect(etapasConcluidas({ ...completo, espaco_proprio: false, atende_domicilio: true, raio_km: 25 }, { fotos: 3 }).has(3)).toBe(true);
    expect(etapasConcluidas({ ...completo, cidade_id: null }, { fotos: 3 }).has(3)).toBe(false);
    expect(etapasConcluidas({ ...completo, capacidade_min: 300 }, { fotos: 3 }).has(4)).toBe(false);
    expect(etapasConcluidas(completo, { fotos: 2 }).has(5)).toBe(false);
    expect(etapasConcluidas(completo, { fotos: 3 }).has(5)).toBe(true);
  });

  it('publica com as etapas 1 a 5 concluídas', () => {
    expect(podePublicar(completo, { fotos: 3 })).toBe(true);
    expect(podePublicar(completo, { fotos: 2 })).toBe(false);
    expect(proximaEtapa(completo, { fotos: 3 })).toBe(6);
  });
});

describe('completude', () => {
  it('vai de 0 a 100 com os pesos do plano', () => {
    expect(completude(vazio, { fotos: 0 })).toBe(0);
    expect(completude(completo, { fotos: 5 })).toBe(100);
    expect(completude(completo, { fotos: 3 })).toBe(90);
    expect(completude({ ...completo, descricao: 'x'.repeat(100) }, { fotos: 5 })).toBe(93);
  });
});

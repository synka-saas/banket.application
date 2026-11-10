import { beforeEach, describe, expect, it, vi } from 'vitest';

const gravarMetrica = vi.fn();
vi.mock('./db', () => ({ gravarMetrica: (...args: unknown[]) => gravarMetrica(...args) }));

const { registrarAcesso, INTERVALO_ACESSO_MS } = await import('./acessos');

describe('registrarAcesso', () => {
  beforeEach(() => gravarMetrica.mockClear());

  it('grava uma vez por intervalo e de novo depois dele', () => {
    const t0 = new Date('2026-10-23T15:00:00Z');
    registrarAcesso('u1', 't1', t0);
    registrarAcesso('u1', 't1', new Date(t0.getTime() + 60_000));
    expect(gravarMetrica).toHaveBeenCalledTimes(1);
    registrarAcesso('u1', 't1', new Date(t0.getTime() + INTERVALO_ACESSO_MS));
    expect(gravarMetrica).toHaveBeenCalledTimes(2);
  });

  it('separa empresas do mesmo usuário e usa o dia de São Paulo', () => {
    registrarAcesso('u2', 't1', new Date('2026-10-24T02:30:00Z'));
    registrarAcesso('u2', 't2', new Date('2026-10-24T02:30:00Z'));
    expect(gravarMetrica).toHaveBeenCalledTimes(2);
    expect(gravarMetrica.mock.calls[0][1]).toEqual(['t1', 'u2', '2026-10-23']);
  });
});

import { describe, expect, it } from 'vitest';
import { excedeu, ipDaRequisicao, permitir, zerar } from './rateLimit';

describe('rateLimit', () => {
  it('permite até o limite dentro da janela e libera depois dela', () => {
    const t0 = 1_000_000;
    expect(permitir('rl:a', 2, 1000, t0)).toBe(true);
    expect(permitir('rl:a', 2, 1000, t0 + 1)).toBe(true);
    expect(permitir('rl:a', 2, 1000, t0 + 2)).toBe(false);
    expect(permitir('rl:a', 2, 1000, t0 + 1000)).toBe(true);
  });

  it('excedeu consulta sem registrar e zerar limpa a contagem', () => {
    const t0 = 2_000_000;
    expect(excedeu('rl:b', 2, 1000, t0)).toBe(false);
    permitir('rl:b', 2, 1000, t0);
    expect(excedeu('rl:b', 2, 1000, t0)).toBe(false);
    permitir('rl:b', 2, 1000, t0);
    expect(excedeu('rl:b', 2, 1000, t0)).toBe(true);
    expect(excedeu('rl:b', 2, 1000, t0 + 1000)).toBe(false);
    zerar('rl:b');
    expect(excedeu('rl:b', 2, 1000, t0)).toBe(false);
  });

  it('usa o IP informado pelo proxy, nunca o forjável do início do X-Forwarded-For', () => {
    const forjado = { 'x-forwarded-for': '1.2.3.4, 203.0.113.9' };
    expect(ipDaRequisicao(new Request('http://x', { headers: { ...forjado, 'x-real-ip': '203.0.113.9' } }), '127.0.0.1')).toBe('203.0.113.9');
    expect(ipDaRequisicao(new Request('http://x', { headers: forjado }), '127.0.0.1')).toBe('203.0.113.9');
    expect(ipDaRequisicao(new Request('http://x'), '127.0.0.1')).toBe('127.0.0.1');
  });
});

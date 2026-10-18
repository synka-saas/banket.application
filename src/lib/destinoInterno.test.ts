import { describe, expect, it } from 'vitest';
import { destinoInterno } from './auth';

describe('destinoInterno', () => {
  it('aceita caminhos do próprio site', () => {
    expect(destinoInterno('/eventos?x=1#a')).toBe('/eventos?x=1#a');
    expect(destinoInterno('/')).toBe('/');
  });
  it('recusa outros hosts, barras invertidas e esquemas', () => {
    for (const v of ['//evil.com', '/\\evil.com', '/\\/evil.com', 'https://evil.com', 'evil.com', '/%0d%0aSet-Cookie', '\t/x', '', null]) {
      const r = destinoInterno(v as string | null);
      expect(r === null || r.startsWith('/') && !r.startsWith('//'), String(v)).toBe(true);
    }
    expect(destinoInterno('//evil.com')).toBeNull();
    expect(destinoInterno('/\\evil.com')).toBeNull();
  });
});

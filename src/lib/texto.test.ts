import { describe, expect, it } from 'vitest';
import { renderTexto } from './texto';

describe('renderTexto', () => {
  it('converte subtítulos, listas, negrito e parágrafos', () => {
    const html = renderTexto('## Valores\n- Até 30 – **R$ 1.000,00**\n- Acima\n\nLinha 1\nLinha 2');
    expect(html).toBe(
      '<h4>Valores</h4><ul><li>Até 30 – <strong>R$ 1.000,00</strong></li><li>Acima</li></ul><p>Linha 1<br />Linha 2</p>'
    );
  });

  it('escapa HTML digitado pelo usuário', () => {
    expect(renderTexto('<script>alert(1)</script> **<b>x</b>**')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt; <strong>&lt;b&gt;x&lt;/b&gt;</strong></p>'
    );
  });

  it('aceita marcador • e texto vazio', () => {
    expect(renderTexto('• Item')).toBe('<ul><li>Item</li></ul>');
    expect(renderTexto('')).toBe('');
    expect(renderTexto(null)).toBe('');
  });
});

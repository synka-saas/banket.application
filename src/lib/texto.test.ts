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

  it('suporta título, lista numerada, itálico, centralizado e quebra de página (documentos)', () => {
    const html = renderTexto('# Cláusula 1\n1. Primeiro _item_\n2) Segundo\n>> Centro\n---\nFim');
    expect(html).toBe(
      '<h3>Cláusula 1</h3><ol><li>Primeiro <em>item</em></li><li>Segundo</li></ol><p class="centro">Centro</p><div class="quebra-pagina"></div><p>Fim</p>'
    );
    // sublinhado dentro de palavra não vira itálico
    expect(renderTexto('numero_parcelas e {prazo_pagamento_saldo}')).toBe('<p>numero_parcelas e {prazo_pagamento_saldo}</p>');
  });
});

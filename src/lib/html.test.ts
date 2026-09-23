import { describe, expect, it } from 'vitest';
import { escapeHtml, html } from './html';

describe('html', () => {
  it('escapa interpolações comuns', () => {
    expect(html`<b>${'<script>"x"</script>'}</b>`.__html).toBe('<b>&lt;script&gt;&quot;x&quot;&lt;/script&gt;</b>');
  });

  it('mantém trechos html aninhados e junta arrays', () => {
    const itens = ['a', '<b>'].map((i) => html`<li>${i}</li>`);
    expect(html`<ul>${itens}</ul>`.__html).toBe('<ul><li>a</li><li>&lt;b&gt;</li></ul>');
  });

  it('ignora false, null e undefined', () => {
    expect(html`<input ${false} ${null} ${undefined} />`.__html).toBe('<input    />');
  });

  it('escapa atributos com JSON', () => {
    expect(escapeHtml(JSON.stringify({ nome: "O'Neil" }))).toBe('{&quot;nome&quot;:&quot;O&#39;Neil&quot;}');
  });
});

import { describe, expect, it } from 'vitest';
import { aplicarVariaveis, envioSchema, mensagemHtml } from './envio';

describe('envio da proposta', () => {
  it('substitui variáveis conhecidas e preserva as desconhecidas', () => {
    expect(aplicarVariaveis('Olá {nome_cliente}, {x}', { nome_cliente: 'Ana' })).toBe('Olá Ana, {x}');
  });

  it('escapa HTML da mensagem e preserva parágrafos', () => {
    const html = mensagemHtml('Linha 1\nLinha <b>2</b>\n\nOutro', 'Buffet & Cia');
    expect(html).toContain('Linha 1<br>Linha &lt;b&gt;2&lt;/b&gt;');
    expect(html.match(/<p /g)).toHaveLength(3);
    expect(html).toContain('Buffet &amp; Cia');
  });

  it('aceita vários destinatários e rejeita e-mail inválido', () => {
    expect(envioSchema.parse({ numero: '2', para: 'a@x.com, B@Y.com', assunto: 's', mensagem: 'm' }).para).toEqual(['a@x.com', 'b@y.com']);
    expect(() => envioSchema.parse({ numero: '1', para: 'nao-e-email', assunto: 's', mensagem: 'm' })).toThrow();
  });
});

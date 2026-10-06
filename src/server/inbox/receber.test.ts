import { describe, expect, it } from 'vitest';
import { extrairReferencias, extrairToken, limparHtmlEmail, mapearStatus } from './receber';

describe('extrairToken', () => {
  const dominio = 'respostas.banket.com.br';
  it('acha o token no endereço de resposta, com ou sem nome de exibição', () => {
    expect(extrairToken(['cliente@gmail.com', 'r-0123456789abcdef0123@respostas.banket.com.br'], dominio)).toBe('0123456789abcdef0123');
    expect(extrairToken(['Banket <R-0123456789ABCDEF0123@Respostas.Banket.com.br>'], dominio)).toBe('0123456789abcdef0123');
  });
  it('ignora outros domínios, tokens malformados e domínio não configurado', () => {
    expect(extrairToken(['r-0123456789abcdef0123@outro.com.br'], dominio)).toBeNull();
    expect(extrairToken(['r-abc@respostas.banket.com.br'], dominio)).toBeNull();
    expect(extrairToken(['r-0123456789abcdef0123@respostas.banket.com.br'], null)).toBeNull();
  });
});

describe('extrairReferencias', () => {
  it('lê In-Reply-To e References, sem repetir', () => {
    const r = extrairReferencias({ 'in-reply-to': '<a@x>', references: '<b@x> <a@x>\n <c@x>' });
    expect(r.inReplyTo).toBe('<a@x>');
    expect(r.referencias).toEqual(['<b@x>', '<a@x>', '<c@x>']);
    expect(extrairReferencias({})).toEqual({ inReplyTo: null, referencias: [] });
  });
});

describe('limparHtmlEmail', () => {
  it('remove scripts, iframes, handlers e links javascript:', () => {
    const sujo = `<p onclick="x()">Oi</p><script>alert(1)</script><iframe src="x"></iframe><a href="javascript:alert(1)">l</a><a href="https://ok">ok</a>`;
    const limpo = limparHtmlEmail(sujo);
    expect(limpo).not.toMatch(/script|iframe|onclick|javascript:/i);
    expect(limpo).toContain('<p>Oi</p>');
    expect(limpo).toContain('href="https://ok"');
  });
});

describe('mapearStatus', () => {
  it('traduz os eventos de entrega', () => {
    expect(mapearStatus('email.delivered')).toEqual({ status: 'entregue', detalhe: null });
    expect(mapearStatus('email.bounced', { bounce: { message: 'Caixa cheia' } })).toEqual({ status: 'devolvida', detalhe: 'Caixa cheia' });
    expect(mapearStatus('email.complained')?.status).toBe('devolvida');
    expect(mapearStatus('email.failed')?.status).toBe('falhou');
    expect(mapearStatus('email.delivery_delayed')?.status).toBeNull();
    expect(mapearStatus('email.sent')).toBeNull();
    expect(mapearStatus('contact.created')).toBeNull();
  });
});

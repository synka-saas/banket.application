import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assinaturaWebhookValida, numeroWhatsapp, parametro, statusDaMeta } from './whatsapp';
import { horasAteAvisoDePrazo, tempoRespostaValido, textoTempoResposta } from './tempoResposta';

describe('whatsapp', () => {
  it('número: celular com DDD ganha o 55; fixo e lixo são recusados', () => {
    expect(numeroWhatsapp('(11) 98765-4321')).toBe('5511987654321');
    expect(numeroWhatsapp('+55 11 98765-4321')).toBe('5511987654321');
    expect(numeroWhatsapp('(11) 3456-7890')).toBeNull();
    expect(numeroWhatsapp('')).toBeNull();
  });

  it('parâmetro: sem quebra de linha nem espaços repetidos, vazio vira travessão, longo é cortado', () => {
    expect(parametro('a\nb\t c    d')).toBe('a b c d');
    expect(parametro('')).toBe('—');
    expect(parametro(null)).toBe('—');
    expect(parametro('x'.repeat(200), 10)).toHaveLength(10);
  });

  it('assinatura do webhook (X-Hub-Signature-256)', () => {
    const corpo = '{"a":1}';
    const sig = `sha256=${createHmac('sha256', 'segredo').update(corpo).digest('hex')}`;
    expect(assinaturaWebhookValida(corpo, sig, 'segredo')).toBe(true);
    expect(assinaturaWebhookValida(corpo, sig, 'outro')).toBe(false);
    expect(assinaturaWebhookValida(corpo, null, 'segredo')).toBe(false);
    expect(assinaturaWebhookValida(corpo, 'sha256=zz', 'segredo')).toBe(false);
  });

  it('status da Meta', () => {
    expect(statusDaMeta('delivered')).toBe('entregue');
    expect(statusDaMeta('read')).toBe('lida');
    expect(statusDaMeta('outro')).toBeNull();
  });
});

describe('tempo de resposta', () => {
  it('opções, texto e aviso de prazo só acima de 12 h (quando restam 25%)', () => {
    expect(tempoRespostaValido(48)).toBe(true);
    expect(tempoRespostaValido(5)).toBe(false);
    expect(textoTempoResposta(24)).toBe('Responde em até 24 horas');
    expect(horasAteAvisoDePrazo(48)).toBe(36);
    expect(horasAteAvisoDePrazo(24)).toBe(18);
    expect(horasAteAvisoDePrazo(12)).toBeNull();
    expect(horasAteAvisoDePrazo(2)).toBeNull();
  });
});

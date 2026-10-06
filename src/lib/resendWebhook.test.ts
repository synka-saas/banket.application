import { describe, expect, it } from 'vitest';
import { assinarSvix, verificarAssinaturaSvix } from './resendWebhook';

const SECRET = 'whsec_' + Buffer.from('segredo-de-teste-com-32-bytes!!').toString('base64');
const corpo = '{"type":"email.received","data":{"email_id":"abc"}}';
const agora = 1_800_000_000_000;
const ts = String(Math.floor(agora / 1000));

describe('verificarAssinaturaSvix', () => {
  it('aceita a assinatura v1 correta dentro da tolerância', () => {
    const sig = assinarSvix('msg_1', ts, corpo, SECRET);
    expect(verificarAssinaturaSvix(corpo, { id: 'msg_1', timestamp: ts, signature: `v1,${sig}` }, SECRET, agora)).toBe(true);
  });

  it('aceita quando uma das várias assinaturas confere', () => {
    const sig = assinarSvix('msg_1', ts, corpo, SECRET);
    const header = `v1,${Buffer.from('outra').toString('base64')} v1,${sig}`;
    expect(verificarAssinaturaSvix(corpo, { id: 'msg_1', timestamp: ts, signature: header }, SECRET, agora)).toBe(true);
  });

  it('recusa segredo errado, corpo adulterado e cabeçalho malformado', () => {
    const sig = assinarSvix('msg_1', ts, corpo, SECRET);
    const ok = { id: 'msg_1', timestamp: ts, signature: `v1,${sig}` };
    expect(verificarAssinaturaSvix(corpo, ok, 'whsec_' + Buffer.from('outro segredo').toString('base64'), agora)).toBe(false);
    expect(verificarAssinaturaSvix(corpo + ' ', ok, SECRET, agora)).toBe(false);
    expect(verificarAssinaturaSvix(corpo, { ...ok, signature: sig }, SECRET, agora)).toBe(false);
    expect(verificarAssinaturaSvix(corpo, { ...ok, signature: `v0,${sig}` }, SECRET, agora)).toBe(false);
    expect(verificarAssinaturaSvix(corpo, { ...ok, id: null }, SECRET, agora)).toBe(false);
    expect(verificarAssinaturaSvix(corpo, ok, '', agora)).toBe(false);
  });

  it('recusa timestamp fora da tolerância (replay)', () => {
    const antigo = String(Math.floor(agora / 1000) - 10 * 60);
    const sig = assinarSvix('msg_1', antigo, corpo, SECRET);
    expect(verificarAssinaturaSvix(corpo, { id: 'msg_1', timestamp: antigo, signature: `v1,${sig}` }, SECRET, agora)).toBe(false);
    expect(verificarAssinaturaSvix(corpo, { id: 'msg_1', timestamp: 'ontem', signature: `v1,${sig}` }, SECRET, agora)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { extrairConfig, montarFormulario, resumirRespostas, validarRespostas } from './modelo';

const custom = {
  id: 'c_tema01',
  custom: true,
  ativa: true,
  rotulo: 'Tema da festa',
  tipo: 'texto',
  opcoes: [],
  obrigatoria: true,
};

const baseB2C = {
  nome: 'Ana',
  email: 'ana@exemplo.com',
  whatsapp: '(11) 99999-0000',
  natureza: 'B2C',
  local_tipo: 'espaco_proprio',
  b2c_ocasiao: 'casamento',
  b2c_data: '2027-05-10',
  b2c_budget: 'ate_10k',
  formato_servico: 'ilhas',
  bebidas: 'openbar',
};

describe('montarFormulario', () => {
  it('sem configuração, usa todas as sessões e perguntas do modelo ativas', () => {
    const form = montarFormulario({});
    expect(form.map((s) => s.chave)).toEqual([
      'contato', 'local', 'dimensionamento_b2b', 'dimensionamento_b2c', 'gastronomia', 'detalhes',
    ]);
    expect(form.every((s) => s.ativa && s.perguntas.every((p) => p.ativa))).toBe(true);
  });

  it('não permite desativar sessão ou perguntas travadas', () => {
    const form = montarFormulario({
      secoes: [{ chave: 'contato', ativa: false, perguntas: [{ chave: 'email', ativa: false, obrigatoria: false }] }],
    });
    const contato = form[0];
    expect(contato.ativa).toBe(true);
    const email = contato.perguntas.find((p) => p.id === 'email')!;
    expect(email).toMatchObject({ ativa: true, obrigatoria: true, travada: true });
  });

  it('respeita a ordem salva, inclui perguntas padrão ausentes e ignora chaves desconhecidas', () => {
    const form = montarFormulario({
      secoes: [
        {
          chave: 'gastronomia',
          ativa: true,
          perguntas: [custom, { chave: 'bebidas', ativa: false }, { chave: 'inexistente', ativa: true }],
        },
      ],
    });
    const gastro = form.find((s) => s.chave === 'gastronomia')!;
    expect(gastro.perguntas.map((p) => p.id)).toEqual(['c_tema01', 'bebidas', 'formato_servico', 'degustacao']);
    expect(gastro.perguntas[1].ativa).toBe(false);
  });

  it('configuração inválida volta ao padrão', () => {
    expect(montarFormulario({ secoes: 'x' })[1].perguntas.length).toBe(3);
  });

  it('extrairConfig faz o caminho de volta sem perder perguntas personalizadas', () => {
    const form = montarFormulario({ secoes: [{ chave: 'detalhes', ativa: false, perguntas: [custom] }] });
    const config = extrairConfig(form);
    expect(montarFormulario(config)).toEqual(form);
  });
});

describe('validarRespostas', () => {
  const form = montarFormulario({
    secoes: [{ chave: 'gastronomia', ativa: true, perguntas: [custom] }],
  });

  it('valida só as perguntas do fluxo escolhido e descarta as ocultas', () => {
    const r = validarRespostas(form, { ...baseB2C, c_tema01: 'Anos 80', b2b_empresa: 'ignorada', infraestrutura: 'equipada' });
    expect(r.b2c_ocasiao).toBe('casamento');
    expect(r).not.toHaveProperty('b2b_empresa');
    // infraestrutura só aparece para local externo
    expect(r).not.toHaveProperty('infraestrutura');
  });

  it('exige perguntas obrigatórias visíveis, inclusive as personalizadas', () => {
    expect(() => validarRespostas(form, baseB2C)).toThrow(/Tema da festa/);
    expect(() => validarRespostas(form, { ...baseB2C, c_tema01: 'x', local_tipo: 'externo' })).toThrow(/infraestrutura/);
  });

  it('rejeita opção fora da lista', () => {
    expect(() => validarRespostas(form, { ...baseB2C, c_tema01: 'x', bebidas: 'cachaca' })).toThrow(/Opção inválida/);
  });

  it('pergunta desativada não é exigida', () => {
    const semBudget = montarFormulario({
      secoes: [{ chave: 'dimensionamento_b2c', ativa: true, perguntas: [{ chave: 'b2c_budget', ativa: false }] }],
    });
    const { b2c_budget, ...resto } = baseB2C;
    expect(() => validarRespostas(semBudget, resto)).not.toThrow();
    expect(b2c_budget).toBeTruthy();
  });

  it('resumo usa os rótulos das perguntas e opções', () => {
    const r = validarRespostas(form, { ...baseB2C, c_tema01: 'Anos 80' });
    const resumo = resumirRespostas(form, r);
    expect(resumo).toContainEqual(expect.objectContaining({ rotulo: 'Bebidas e bar', valor: 'Open bar completo (alcoólicos)' }));
    expect(resumo).toContainEqual(expect.objectContaining({ rotulo: 'Tema da festa', valor: 'Anos 80' }));
  });
});

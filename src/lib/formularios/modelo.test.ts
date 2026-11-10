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
  email: 'ana@example.com',
  whatsapp: '(11) 99999-0000',
  natureza: 'B2C',
  local_tipo: 'espaco_proprio',
  b2c_ocasiao: 'oc-casamento',
  b2c_data: '2027-05-10',
  b2c_budget: 'ate_10k',
  formato_servico: 'ilhas',
  bebidas: 'openbar',
};

describe('montarFormulario', () => {
  it('sem configuração, usa todas as seções e perguntas do modelo ativas', () => {
    const form = montarFormulario({});
    expect(form.map((s) => s.chave)).toEqual([
      'contato', 'local', 'dimensionamento_b2b', 'dimensionamento_b2c', 'gastronomia', 'detalhes',
    ]);
    expect(form.every((s) => s.ativa && s.perguntas.every((p) => p.ativa))).toBe(true);
  });

  it('não permite desativar seção ou perguntas travadas', () => {
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
    expect(montarFormulario({ secoes: 'x' })[1].perguntas.length).toBe(4);
  });

  it('extrairConfig faz o caminho de volta sem perder perguntas personalizadas', () => {
    const form = montarFormulario({ secoes: [{ chave: 'detalhes', ativa: false, perguntas: [custom] }] });
    const config = extrairConfig(form);
    expect(montarFormulario(config)).toEqual(form);
  });
});

const ocasioes = {
  B2B: [{ valor: 'oc-confra', rotulo: 'Confraternização' }],
  B2C: [{ valor: 'oc-casamento', rotulo: 'Casamento' }],
};

describe('validarRespostas', () => {
  const form = montarFormulario({ secoes: [{ chave: 'gastronomia', ativa: true, perguntas: [custom] }] }, { ocasioes });

  it('valida só as perguntas do fluxo escolhido e descarta as ocultas', () => {
    const r = validarRespostas(form, { ...baseB2C, c_tema01: 'Anos 80', b2b_empresa: 'ignorada', infraestrutura: 'equipada' });
    expect(r.b2c_ocasiao).toBe('oc-casamento');
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

  it('ocasião: opções vêm da matriz de cada fluxo e são exigidas', () => {
    const b2b = form.find((s) => s.chave === 'contato')!.perguntas.find((p) => p.id === 'b2b_ocasiao')!;
    expect(b2b.opcoes).toEqual(ocasioes.B2B);
    expect(b2b.origemOpcoes).toBe('ocasioes');
    expect(() => validarRespostas(form, { ...baseB2C, c_tema01: 'x', b2c_ocasiao: 'oc-confra' })).toThrow(/Opção inválida/);
    expect(() => validarRespostas(form, { ...baseB2C, c_tema01: 'x', b2c_ocasiao: '' })).toThrow(/ocasião/);
  });

  it('ocasião sem nenhuma ocasião ligada ao tipo não aparece nem é exigida', () => {
    const semOcasioes = montarFormulario({ secoes: [{ chave: 'gastronomia', ativa: true, perguntas: [custom] }] });
    const { b2c_ocasiao, ...resto } = baseB2C;
    const r = validarRespostas(semOcasioes, { ...resto, c_tema01: 'x' });
    expect(r).not.toHaveProperty('b2c_ocasiao');
    expect(b2c_ocasiao).toBeTruthy();
  });

  it('resumo usa os rótulos das perguntas e opções', () => {
    const r = validarRespostas(form, { ...baseB2C, c_tema01: 'Anos 80' });
    const resumo = resumirRespostas(form, r);
    expect(resumo).toContainEqual(expect.objectContaining({ rotulo: 'Bebidas e bar', valor: 'Open bar completo (alcoólicos)' }));
    const varias = validarRespostas(form, { ...baseB2C, c_tema01: 'x', bebidas: ['padrao', 'proprio'] });
    expect(resumirRespostas(form, varias)).toContainEqual(
      expect.objectContaining({ rotulo: 'Bebidas e bar', valor: 'Pacote não alcoólico padrão, Levaremos as próprias bebidas alcoólicas' })
    );
    expect(resumo).toContainEqual(expect.objectContaining({ rotulo: 'Tema da festa', valor: 'Anos 80' }));
    expect(resumo).toContainEqual(expect.objectContaining({ rotulo: 'Qual a ocasião?', valor: 'Casamento' }));
  });
});

describe('backlog 10/11/2026', () => {
  const espacos = [
    { valor: 'esp-1', rotulo: 'Salão Jardim', descricao: 'Rua das Flores, 100' },
    { valor: 'esp-2', rotulo: 'Casa Club' },
  ];
  const form = montarFormulario({}, { ocasioes, espacos });

  it('nosso espaço pede qual dos espaços próprios; região só no local externo', () => {
    const r = validarRespostas(form, { ...baseB2C, espaco: 'esp-2', regiao: 'ignorada' });
    expect(r.espaco).toBe('esp-2');
    expect(r).not.toHaveProperty('regiao');
    expect(() => validarRespostas(form, { ...baseB2C, espaco: '' })).toThrow(/nossos espaços/);
    const externo = validarRespostas(form, { ...baseB2C, local_tipo: 'externo', infraestrutura: 'equipada', regiao: 'Campinas', espaco: 'esp-1' });
    expect(externo.regiao).toBe('Campinas');
    expect(externo).not.toHaveProperty('espaco');
  });

  it('sem espaço próprio cadastrado, a pergunta do espaço não aparece', () => {
    const semEspacos = montarFormulario({}, { ocasioes });
    expect(() => validarRespostas(semEspacos, baseB2C)).not.toThrow();
  });

  it('faixas de budget editáveis: as opções do buffet substituem as do modelo e voltam pelo extrairConfig', () => {
    const proprio = montarFormulario(
      { secoes: [{ chave: 'dimensionamento_b2c', ativa: true, perguntas: [{ chave: 'b2c_budget', ativa: true, opcoes: ['Até R$ 20 mil', 'Mais de R$ 20 mil'] }] }] },
      { ocasioes }
    );
    const budget = proprio.find((s) => s.chave === 'dimensionamento_b2c')!.perguntas.find((p) => p.id === 'b2c_budget')!;
    expect(budget.opcoesEditaveis).toBe(true);
    expect(budget.opcoes.map((o) => o.rotulo)).toEqual(['Até R$ 20 mil', 'Mais de R$ 20 mil']);
    expect(validarRespostas(proprio, { ...baseB2C, b2c_budget: 'Até R$ 20 mil' }).b2c_budget).toBe('Até R$ 20 mil');
    const cfg = extrairConfig(proprio).secoes.find((s) => s.chave === 'dimensionamento_b2c')!;
    expect(cfg.perguntas.find((p) => 'chave' in p && p.chave === 'b2c_budget')).toMatchObject({ opcoes: ['Até R$ 20 mil', 'Mais de R$ 20 mil'] });
    // Sem troca, nada de opções na configuração
    const padrao = extrairConfig(montarFormulario({})).secoes.find((s) => s.chave === 'dimensionamento_b2c')!;
    expect(padrao.perguntas.find((p) => 'chave' in p && p.chave === 'b2c_budget')).not.toHaveProperty('opcoes');
  });

  it('corporativo também pergunta staff de terceiros e restrições; sem "3 orçamentos"', () => {
    const b2b = form.find((s) => s.chave === 'dimensionamento_b2b')!.perguntas;
    expect(b2b.map((p) => p.id)).toEqual(expect.arrayContaining(['b2b_staff', 'b2b_restricoes']));
    expect(b2b.find((p) => p.id === 'b2b_compliance')!.opcoes.map((o) => o.valor)).not.toContain('tres_orcamentos');
  });

  it('WhatsApp exige DDD e número completo', () => {
    expect(() => validarRespostas(form, { ...baseB2C, whatsapp: '(99) 3213-836' })).toThrow(/com DDD/);
    expect(() => validarRespostas(form, { ...baseB2C, whatsapp: '91234-5678' })).toThrow(/com DDD/);
    expect(validarRespostas(form, { ...baseB2C, espaco: 'esp-1', whatsapp: '(11) 3333-4444' }).whatsapp).toBe('(11) 3333-4444');
  });
});

describe('decisões de 10/11/2026', () => {
  it('ocasião logo depois do tipo do evento, mesmo com configuração antiga', () => {
    const antigo = montarFormulario(
      {
        secoes: [
          { chave: 'contato', ativa: true, perguntas: [{ chave: 'nome', ativa: true }, { chave: 'email', ativa: true }, { chave: 'whatsapp', ativa: true }, { chave: 'natureza', ativa: true }, { ...custom, obrigatoria: false }] },
          { chave: 'dimensionamento_b2c', ativa: true, perguntas: [{ chave: 'b2c_ocasiao', ativa: true }, { chave: 'b2c_data', ativa: true }] },
        ],
      },
      { ocasioes }
    );
    const contato = antigo.find((s) => s.chave === 'contato')!;
    expect(contato.perguntas.map((p) => p.id)).toEqual(['nome', 'email', 'whatsapp', 'natureza', 'b2b_ocasiao', 'b2c_ocasiao', 'c_tema01']);
    expect(contato.perguntas[3].rotulo).toBe('O evento é corporativo ou social?');
    expect(antigo.find((s) => s.chave === 'dimensionamento_b2c')!.perguntas.map((p) => p.id)).not.toContain('b2c_ocasiao');
    expect(contato.perguntas.find((p) => p.id === 'b2c_ocasiao')!.opcoes).toEqual(ocasioes.B2C);
  });
});

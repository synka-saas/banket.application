// Modelo do formulário de captação (baseado no formulario-template.html) e regras de configuração.
// Compartilhado entre servidor, editor (ilha Preact) e página pública: não acessa o banco.
//
// As sessões e perguntas padrão vivem aqui. No banco (formularios.config) ficam só os ajustes:
// sessão ativa/inativa, perguntas padrão ativas/obrigatórias, ordem e perguntas personalizadas.
import { z } from 'zod';

export type TipoPergunta =
  | 'texto'
  | 'texto_longo'
  | 'numero'
  | 'data'
  | 'email'
  | 'telefone'
  | 'selecao'
  | 'unica'
  | 'multipla'
  | 'sim_nao';

export const TIPOS_PERGUNTA: Record<TipoPergunta, string> = {
  texto: 'Texto curto',
  texto_longo: 'Texto longo',
  numero: 'Número',
  data: 'Data',
  email: 'E-mail',
  telefone: 'Telefone',
  selecao: 'Lista de opções',
  unica: 'Escolha única',
  multipla: 'Múltipla escolha',
  sim_nao: 'Sim / Não',
};

/** Tipos que exigem uma lista de opções. */
export const TIPOS_COM_OPCOES: TipoPergunta[] = ['selecao', 'unica', 'multipla'];

export type Fluxo = 'todos' | 'B2B' | 'B2C';

export interface Opcao {
  valor: string;
  rotulo: string;
  descricao?: string;
}

interface PerguntaModelo {
  chave: string;
  rotulo: string;
  tipo: TipoPergunta;
  opcoes?: Opcao[];
  placeholder?: string;
  ajuda?: string;
  obrigatoria: boolean;
  /** Pergunta essencial: sempre ativa e com obrigatoriedade fixa. */
  travada?: boolean;
  /** Só aparece quando outra pergunta tem o valor informado. */
  mostrarSe?: { chave: string; valor: string };
}

interface SecaoModelo {
  chave: string;
  titulo: string;
  descricao: string;
  icone: string;
  fluxo: Fluxo;
  travada?: boolean;
  perguntas: PerguntaModelo[];
}

const op = (valor: string, rotulo: string, descricao?: string): Opcao => ({ valor, rotulo, ...(descricao ? { descricao } : {}) });

export const MODELO_SECOES: SecaoModelo[] = [
  {
    chave: 'contato',
    titulo: 'Olá! Vamos criar algo inesquecível?',
    descricao: 'Para começarmos a desenhar sua experiência, por favor, nos conte um pouco sobre você.',
    icone: 'auto_awesome',
    fluxo: 'todos',
    travada: true,
    perguntas: [
      { chave: 'nome', rotulo: 'Nome / Responsável', tipo: 'texto', placeholder: 'Como gosta de ser chamado?', obrigatoria: true, travada: true },
      { chave: 'email', rotulo: 'E-mail', tipo: 'email', placeholder: 'seu@email.com', obrigatoria: true, travada: true },
      { chave: 'whatsapp', rotulo: 'WhatsApp', tipo: 'telefone', placeholder: '(00) 00000-0000', obrigatoria: true, travada: true },
      {
        chave: 'natureza',
        rotulo: 'Qual a natureza deste evento?',
        tipo: 'unica',
        opcoes: [op('B2B', 'Corporativo (B2B)', 'Empresas e negócios.'), op('B2C', 'Social (B2C)', 'Casamentos e festas.')],
        obrigatoria: true,
        travada: true,
      },
    ],
  },
  {
    chave: 'local',
    titulo: 'Onde será o evento?',
    descricao: 'Precisamos entender o espaço para garantir a melhor logística da nossa cozinha central.',
    icone: 'location_on',
    fluxo: 'todos',
    perguntas: [
      {
        chave: 'local_tipo',
        rotulo: 'Local do evento',
        tipo: 'unica',
        opcoes: [
          op('espaco_proprio', 'Nosso espaço', 'Infraestrutura completa e isenção de frete.'),
          op('externo', 'Local externo', 'Empresa, residência ou espaço alugado.'),
        ],
        obrigatoria: true,
      },
      {
        chave: 'infraestrutura',
        rotulo: 'Como é a infraestrutura do local?',
        tipo: 'unica',
        opcoes: [
          op('equipada', 'Possui cozinha equipada (forno, fogão, geladeiras).'),
          op('sem_estrutura', 'Não possui estrutura (precisaremos montar a cozinha).'),
        ],
        obrigatoria: true,
        mostrarSe: { chave: 'local_tipo', valor: 'externo' },
      },
      { chave: 'regiao', rotulo: 'Região / CEP', tipo: 'texto', placeholder: '00000-000 ou bairro/cidade', obrigatoria: false },
    ],
  },
  {
    chave: 'dimensionamento_b2b',
    titulo: 'Dimensionamento',
    descricao: 'Detalhes para formatarmos a proposta ideal para o seu perfil.',
    icone: 'domain',
    fluxo: 'B2B',
    perguntas: [
      { chave: 'b2b_empresa', rotulo: 'Razão social / Empresa', tipo: 'texto', placeholder: 'Sua Empresa LTDA', obrigatoria: true },
      { chave: 'b2b_data', rotulo: 'Data prevista', tipo: 'data', obrigatoria: true },
      { chave: 'b2b_participantes', rotulo: 'Quantidade de participantes', tipo: 'numero', placeholder: 'Ex.: 150', obrigatoria: true },
      {
        chave: 'b2b_perfil',
        rotulo: 'Perfil do público',
        tipo: 'selecao',
        opcoes: [
          op('diretoria', 'Diretoria / Executivos'),
          op('colaboradores', 'Colaboradores (geral)'),
          op('clientes', 'Clientes VIPs'),
        ],
        obrigatoria: true,
      },
      {
        chave: 'b2b_budget',
        rotulo: 'Estimativa de verba (budget)',
        tipo: 'selecao',
        opcoes: [
          op('ate_5k', 'Até R$ 5.000'),
          op('5k_15k', 'De R$ 5.000 a R$ 15.000'),
          op('15k_30k', 'De R$ 15.000 a R$ 30.000'),
          op('acima_30k', 'Acima de R$ 30.000'),
        ],
        obrigatoria: true,
      },
      {
        chave: 'b2b_aprovacao',
        rotulo: 'Processo de aprovação',
        tipo: 'texto',
        placeholder: 'Ex.: Compras, RH e Diretoria',
        ajuda: 'Outras áreas estão envolvidas na decisão?',
        obrigatoria: false,
      },
      {
        chave: 'b2b_compliance',
        rotulo: 'Requisitos de compliance comercial',
        tipo: 'multipla',
        opcoes: [
          op('faturamento_prazo', 'Faturamento a prazo'),
          op('laudos_vigilancia', 'Exigência de laudos/alvarás (Vigilância)'),
          op('tres_orcamentos', 'Precisa de 3 orçamentos comparativos'),
        ],
        obrigatoria: false,
      },
    ],
  },
  {
    chave: 'dimensionamento_b2c',
    titulo: 'Dimensionamento',
    descricao: 'Detalhes para formatarmos a proposta ideal para o seu perfil.',
    icone: 'group',
    fluxo: 'B2C',
    perguntas: [
      {
        chave: 'b2c_ocasiao',
        rotulo: 'Ocasião',
        tipo: 'selecao',
        opcoes: [op('casamento', 'Casamento'), op('debutante', '15 anos'), op('aniversario', 'Aniversário / Bodas')],
        obrigatoria: true,
      },
      { chave: 'b2c_data', rotulo: 'Data do evento', tipo: 'data', obrigatoria: true },
      { chave: 'b2c_adultos', rotulo: 'Convidados adultos (acima de 12 anos)', tipo: 'numero', placeholder: '0', obrigatoria: false },
      { chave: 'b2c_criancas', rotulo: 'Crianças (6 a 11 anos)', tipo: 'numero', placeholder: '0', obrigatoria: false },
      {
        chave: 'b2c_staff',
        rotulo: 'Staff de terceiros',
        tipo: 'numero',
        placeholder: '0',
        ajuda: 'Profissionais contratados por você (fotografia, banda…) que também serão servidos.',
        obrigatoria: false,
      },
      {
        chave: 'b2c_budget',
        rotulo: 'Estimativa de investimento (budget)',
        tipo: 'selecao',
        opcoes: [
          op('ate_10k', 'Até R$ 10.000'),
          op('10k_25k', 'De R$ 10.000 a R$ 25.000'),
          op('25k_50k', 'De R$ 25.000 a R$ 50.000'),
          op('acima_50k', 'Acima de R$ 50.000'),
        ],
        obrigatoria: true,
      },
      {
        chave: 'b2c_restricoes',
        rotulo: 'Restrições e preferências alimentares',
        tipo: 'texto',
        placeholder: 'Ex.: vegano, intolerância à lactose, sem glúten…',
        obrigatoria: false,
      },
    ],
  },
  {
    chave: 'gastronomia',
    titulo: 'Gastronomia & Experiência',
    descricao: 'O sabor é a alma do evento. Como deseja servir seus convidados?',
    icone: 'chef_hat',
    fluxo: 'todos',
    perguntas: [
      {
        chave: 'formato_servico',
        rotulo: 'Formato do serviço',
        tipo: 'unica',
        opcoes: [
          op('coquetel', 'Coquetel / Finger food', 'Ágil, pessoas em pé'),
          op('ilhas', 'Ilhas gastronômicas', 'Estações montadas'),
          op('empratado', 'Jantar completo', 'Empratado clássico'),
        ],
        obrigatoria: true,
      },
      {
        chave: 'bebidas',
        rotulo: 'Bebidas e bar',
        tipo: 'unica',
        opcoes: [
          op('padrao', 'Pacote não alcoólico padrão'),
          op('openbar', 'Open bar completo (alcoólicos)'),
          op('proprio', 'Levaremos as próprias bebidas alcoólicas'),
        ],
        obrigatoria: true,
      },
      {
        chave: 'degustacao',
        rotulo: 'Gostaria de agendar uma degustação?',
        tipo: 'unica',
        ajuda: 'Nosso maior diferencial é o sabor.',
        opcoes: [
          op('semana', 'Sim, tenho disponibilidade em dias de semana.'),
          op('sabado', 'Sim, prefiro aos sábados.'),
          op('nao', 'No momento não, quero apenas receber a estimativa inicial.'),
        ],
        obrigatoria: false,
      },
    ],
  },
  {
    chave: 'detalhes',
    titulo: 'Detalhes finais',
    descricao: 'Alguma observação extra para o seu evento?',
    icone: 'add_comment',
    fluxo: 'todos',
    perguntas: [
      {
        chave: 'detalhes',
        rotulo: 'Detalhes e desejos específicos',
        tipo: 'texto_longo',
        placeholder: 'Existe mais algum detalhe, tema ou observação importante que gostaria de compartilhar conosco?',
        obrigatoria: false,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Configuração salva no banco
// ---------------------------------------------------------------------------
const textoOpcional = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined), z.string().max(max).optional());

const perguntaPadraoConfig = z.object({
  chave: z.string().min(1).max(60),
  ativa: z.boolean(),
  obrigatoria: z.boolean().optional(),
});

const perguntaCustomConfig = z
  .object({
    id: z.string().regex(/^c_[a-z0-9]{4,24}$/, 'Identificador de pergunta inválido.'),
    custom: z.literal(true),
    ativa: z.boolean(),
    rotulo: z.string().trim().min(1, 'Informe o texto da pergunta.').max(200, 'A pergunta pode ter no máximo 200 caracteres.'),
    tipo: z.enum(Object.keys(TIPOS_PERGUNTA) as [TipoPergunta, ...TipoPergunta[]], { error: 'Tipo de pergunta inválido.' }),
    opcoes: z
      .array(z.string().trim().min(1).max(120, 'Cada opção pode ter no máximo 120 caracteres.'))
      .max(30, 'Use no máximo 30 opções.')
      .default([])
      .transform((lista) => lista.filter((o, i) => lista.indexOf(o) === i)),
    obrigatoria: z.boolean(),
    placeholder: textoOpcional(200),
    ajuda: textoOpcional(300),
  })
  .refine((p) => !TIPOS_COM_OPCOES.includes(p.tipo) || p.opcoes.length >= 2, {
    message: 'Perguntas de escolha precisam de pelo menos 2 opções.',
  });

const secaoConfig = z.object({
  chave: z.string().min(1).max(60),
  ativa: z.boolean(),
  perguntas: z.array(z.union([perguntaCustomConfig, perguntaPadraoConfig])).max(60).default([]),
});

export const configSchema = z.object({
  secoes: z.array(secaoConfig).max(20).default([]),
});

export type FormularioConfig = z.infer<typeof configSchema>;
type PerguntaConfig = FormularioConfig['secoes'][number]['perguntas'][number];

// ---------------------------------------------------------------------------
// Formulário resolvido (modelo + configuração)
// ---------------------------------------------------------------------------
export interface PerguntaResolvida {
  /** Chave da pergunta padrão ou id da personalizada (c_…); é o nome do campo na resposta. */
  id: string;
  padrao: boolean;
  rotulo: string;
  tipo: TipoPergunta;
  opcoes: Opcao[];
  placeholder: string | null;
  ajuda: string | null;
  obrigatoria: boolean;
  travada: boolean;
  ativa: boolean;
  mostrarSe: { chave: string; valor: string } | null;
}

export interface SecaoResolvida {
  chave: string;
  titulo: string;
  descricao: string;
  icone: string;
  fluxo: Fluxo;
  travada: boolean;
  ativa: boolean;
  perguntas: PerguntaResolvida[];
}

function resolverPadrao(p: PerguntaModelo, cfg?: { ativa: boolean; obrigatoria?: boolean }): PerguntaResolvida {
  const travada = Boolean(p.travada);
  return {
    id: p.chave,
    padrao: true,
    rotulo: p.rotulo,
    tipo: p.tipo,
    opcoes: p.opcoes ?? (p.tipo === 'sim_nao' ? OPCOES_SIM_NAO : []),
    placeholder: p.placeholder ?? null,
    ajuda: p.ajuda ?? null,
    obrigatoria: travada ? p.obrigatoria : (cfg?.obrigatoria ?? p.obrigatoria),
    travada,
    ativa: travada ? true : (cfg?.ativa ?? true),
    mostrarSe: p.mostrarSe ?? null,
  };
}

const OPCOES_SIM_NAO: Opcao[] = [op('sim', 'Sim'), op('nao', 'Não')];

function resolverCustom(p: Extract<PerguntaConfig, { custom: true }>): PerguntaResolvida {
  return {
    id: p.id,
    padrao: false,
    rotulo: p.rotulo,
    tipo: p.tipo,
    opcoes: p.tipo === 'sim_nao' ? OPCOES_SIM_NAO : TIPOS_COM_OPCOES.includes(p.tipo) ? p.opcoes.map((o) => op(o, o)) : [],
    placeholder: p.placeholder ?? null,
    ajuda: p.ajuda ?? null,
    obrigatoria: p.obrigatoria,
    travada: false,
    ativa: p.ativa,
    mostrarSe: null,
  };
}

/** Lê a configuração salva; valores inválidos ou ausentes voltam ao padrão. */
export function lerConfig(raw: unknown): FormularioConfig {
  const parsed = configSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : { secoes: [] };
}

/**
 * Junta o modelo com a configuração: as sessões seguem a ordem do modelo; as perguntas seguem a ordem salva.
 * Perguntas padrão que ainda não estão na configuração entram no fim da sessão; chaves desconhecidas são ignoradas.
 */
export function montarFormulario(raw: unknown): SecaoResolvida[] {
  const config = lerConfig(raw);
  return MODELO_SECOES.map((secao) => {
    const cfg = config.secoes.find((s) => s.chave === secao.chave);
    const modelo = new Map(secao.perguntas.map((p) => [p.chave, p]));
    const vistas = new Set<string>();
    const perguntas: PerguntaResolvida[] = [];

    for (const p of cfg?.perguntas ?? []) {
      if ('custom' in p) {
        if (vistas.has(p.id)) continue;
        vistas.add(p.id);
        perguntas.push(resolverCustom(p));
      } else {
        const base = modelo.get(p.chave);
        if (!base || vistas.has(p.chave)) continue;
        vistas.add(p.chave);
        perguntas.push(resolverPadrao(base, p));
      }
    }
    for (const p of secao.perguntas) if (!vistas.has(p.chave)) perguntas.push(resolverPadrao(p));

    return {
      chave: secao.chave,
      titulo: secao.titulo,
      descricao: secao.descricao,
      icone: secao.icone,
      fluxo: secao.fluxo,
      travada: Boolean(secao.travada),
      ativa: secao.travada ? true : (cfg?.ativa ?? true),
      perguntas,
    };
  });
}

/** Converte o formulário resolvido de volta na configuração enxuta que vai para o banco. */
export function extrairConfig(secoes: SecaoResolvida[]): FormularioConfig {
  return {
    secoes: secoes.map((s) => ({
      chave: s.chave,
      ativa: s.ativa,
      perguntas: s.perguntas.map((p): PerguntaConfig =>
        p.padrao
          ? { chave: p.id, ativa: p.ativa, obrigatoria: p.obrigatoria }
          : {
              id: p.id,
              custom: true,
              ativa: p.ativa,
              rotulo: p.rotulo,
              tipo: p.tipo,
              opcoes: TIPOS_COM_OPCOES.includes(p.tipo) ? p.opcoes.map((o) => o.valor) : [],
              obrigatoria: p.obrigatoria,
              placeholder: p.placeholder ?? undefined,
              ajuda: p.ajuda ?? undefined,
            }
      ),
    })),
  };
}

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------
export type ValorResposta = string | string[] | null;
export type Respostas = Record<string, ValorResposta>;

/** Sessões exibidas para a natureza escolhida (ativas e do mesmo fluxo). */
export function secoesVisiveis(secoes: SecaoResolvida[], natureza: string | null | undefined): SecaoResolvida[] {
  return secoes.filter((s) => s.ativa && (s.fluxo === 'todos' || s.fluxo === natureza));
}

/** Perguntas que o respondente viu, considerando fluxo, perguntas ativas e condições. */
export function perguntasVisiveis(secoes: SecaoResolvida[], respostas: Record<string, unknown>) {
  const natureza = typeof respostas.natureza === 'string' ? respostas.natureza : null;
  return secoesVisiveis(secoes, natureza).flatMap((s) =>
    s.perguntas
      .filter((p) => p.ativa && (!p.mostrarSe || respostas[p.mostrarSe.chave] === p.mostrarSe.valor))
      .map((p) => ({ secao: s, pergunta: p }))
  );
}

function campoResposta(p: PerguntaResolvida): z.ZodType<ValorResposta> {
  const obrigatorio = `Preencha "${p.rotulo}".`;
  const valores = p.opcoes.map((o) => o.valor);

  if (p.tipo === 'multipla') {
    return z.preprocess(
      (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []),
      z
        .array(z.string().refine((v) => valores.includes(v), `Opção inválida em "${p.rotulo}".`))
        .min(p.obrigatoria ? 1 : 0, `Selecione ao menos uma opção em "${p.rotulo}".`)
    );
  }

  let texto: z.ZodType<string, string> = z.string().max(p.tipo === 'texto_longo' ? 5000 : 500, `Resposta muito longa em "${p.rotulo}".`);
  if (p.tipo === 'email') texto = z.email(`E-mail inválido em "${p.rotulo}".`);
  if (p.tipo === 'numero') texto = z.string().regex(/^\d{1,7}([.,]\d{1,2})?$/, `Informe um número válido em "${p.rotulo}".`);
  if (p.tipo === 'data') texto = z.iso.date(`Data inválida em "${p.rotulo}".`);
  if (p.tipo === 'telefone') texto = z.string().regex(/^[\d\s()+-]{8,20}$/, `Telefone inválido em "${p.rotulo}".`);
  if (valores.length) texto = z.string().refine((v) => valores.includes(v), `Opção inválida em "${p.rotulo}".`);

  return z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null),
    p.obrigatoria ? z.string({ error: obrigatorio }).pipe(texto) : texto.nullable()
  );
}

/** Valida as respostas das perguntas visíveis; perguntas ocultas ou desconhecidas são descartadas. */
export function validarRespostas(secoes: SecaoResolvida[], dados: Record<string, unknown>): Respostas {
  const visiveis = perguntasVisiveis(secoes, dados);
  const shape = Object.fromEntries(visiveis.map(({ pergunta }) => [pergunta.id, campoResposta(pergunta)]));
  return z.object(shape).parse(dados) as Respostas;
}

export interface RespostaResumo {
  secao: string;
  chave: string;
  rotulo: string;
  valor: string;
}

/** Snapshot legível das respostas (rótulos das perguntas e das opções no momento do envio). */
export function resumirRespostas(secoes: SecaoResolvida[], respostas: Respostas): RespostaResumo[] {
  return perguntasVisiveis(secoes, respostas).flatMap(({ secao, pergunta }) => {
    const v = respostas[pergunta.id];
    if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) return [];
    const rotuloOpcao = (x: string) => pergunta.opcoes.find((o) => o.valor === x)?.rotulo ?? x;
    const valor = Array.isArray(v) ? v.map(rotuloOpcao).join(', ') : pergunta.opcoes.length ? rotuloOpcao(v) : v;
    const tituloSecao = secao.fluxo === 'todos' ? secao.titulo : `${secao.titulo} (${secao.fluxo})`;
    return [{ secao: tituloSecao, chave: pergunta.id, rotulo: pergunta.rotulo, valor }];
  });
}

/** Rótulo de uma opção padrão (ex.: rotuloOpcao('b2b_budget', 'ate_5k') → 'Até R$ 5.000'). */
export function rotuloOpcao(chave: string, valor: string | null | undefined): string | null {
  if (!valor) return null;
  for (const s of MODELO_SECOES) {
    const p = s.perguntas.find((x) => x.chave === chave);
    if (p) return p.opcoes?.find((o) => o.valor === valor)?.rotulo ?? valor;
  }
  return valor;
}

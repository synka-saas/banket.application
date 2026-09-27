// Sugestões de fontes e cores do template a partir do logotipo, com auxílio de IA.
import { z } from 'zod';
import { openAiJson } from '../lib/openai';
import { FONTES } from './templates';

export const CAMPOS_FONTE = ['fonte_titulo', 'fonte_corpo'] as const;
export const CAMPOS_COR = ['cor_fundo', 'cor_texto_primaria', 'cor_texto_secundaria'] as const;
const CAMPOS = [...CAMPOS_FONTE, ...CAMPOS_COR] as const;
type CampoIdentidade = (typeof CAMPOS)[number];

const PAPEIS: Record<CampoIdentidade, string> = {
  fonte_titulo: 'fonte dos títulos da proposta (capa, cabeçalhos e títulos de seção)',
  fonte_corpo: 'fonte dos parágrafos (texto corrido, tabelas de itens e valores; precisa ser muito legível)',
  cor_fundo: 'cor de fundo das páginas (clara e suave, para o texto ter bom contraste)',
  cor_texto_primaria: 'cor do texto corrido (escura, com contraste alto sobre o fundo)',
  cor_texto_secundaria: 'cor de destaque usada nos títulos (normalmente a cor mais marcante da marca)',
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export const sugestaoSchema = z.object({
  // PNG gerado no navegador a partir do logo (inclusive SVG), já reduzido
  logo: z
    .string()
    .max(3_000_000, 'Imagem do logotipo muito grande.')
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Imagem do logotipo inválida.'),
  modo: z.enum(['sugerir', 'capturar']),
  campos: z.array(z.enum(CAMPOS)).min(1).max(CAMPOS.length),
  atuais: z.record(z.string(), z.string().max(60)).optional(),
});

export type PedidoSugestao = z.infer<typeof sugestaoSchema>;
export type Sugestao = Partial<Record<CampoIdentidade, string>> & { motivo: string };

export async function sugerirIdentidade(pedido: PedidoSugestao): Promise<Sugestao> {
  const campos = [...new Set(pedido.campos)];
  const propriedades: Record<string, unknown> = {};
  for (const c of campos) {
    propriedades[c] = (CAMPOS_FONTE as readonly string[]).includes(c)
      ? { type: 'string', enum: [...FONTES], description: PAPEIS[c] }
      : { type: 'string', description: `${PAPEIS[c]}; formato hexadecimal #RRGGBB` };
  }
  propriedades.motivo = { type: 'string', description: 'justificativa curta (até 200 caracteres), em português' };

  const atuais = Object.entries(pedido.atuais ?? {})
    .filter(([k, v]) => (CAMPOS as readonly string[]).includes(k) && !campos.includes(k as CampoIdentidade) && v)
    .map(([k, v]) => `- ${PAPEIS[k as CampoIdentidade]}: ${v}`)
    .join('\n');

  const tarefa =
    pedido.modo === 'capturar'
      ? 'Extraia a paleta do logotipo e defina as cores abaixo. Use as cores que realmente aparecem no logo; ' +
        'para o fundo, use um tom bem claro derivado da paleta (ou branco/off-white) e garanta contraste legível do texto.'
      : 'Sugira o que for pedido abaixo para combinar com a identidade visual do logotipo (estilo, personalidade, ' +
        'formas da tipografia e paleta), mantendo harmonia com o que já está definido.';

  const usuario = [
    tarefa,
    '',
    'Defina:',
    ...campos.map((c) => `- ${c}: ${PAPEIS[c]}`),
    atuais && `\nJá definido no template (mantenha coerência):\n${atuais}`,
    `\nFontes disponíveis: ${FONTES.join(', ')}.`,
    'A imagem foi colocada sobre fundo branco apenas para a análise; ignore esse fundo.',
  ]
    .filter(Boolean)
    .join('\n');

  const resposta = await openAiJson<Record<string, string>>({
    sistema:
      'Você é designer de identidade visual e ajuda buffets a montar o template da proposta comercial em PDF. ' +
      'Responda somente com o JSON pedido.',
    usuario,
    imagem: pedido.logo,
    nomeSchema: 'identidade_visual',
    schema: { type: 'object', properties: propriedades, required: Object.keys(propriedades), additionalProperties: false },
  });

  const sugestao: Sugestao = { motivo: String(resposta.motivo ?? '').slice(0, 300) };
  for (const c of campos) {
    const v = String(resposta[c] ?? '').trim();
    if ((CAMPOS_FONTE as readonly string[]).includes(c) ? (FONTES as readonly string[]).includes(v) : HEX.test(v)) {
      sugestao[c] = (CAMPOS_COR as readonly string[]).includes(c) ? v.toUpperCase() : v;
    }
  }
  return sugestao;
}

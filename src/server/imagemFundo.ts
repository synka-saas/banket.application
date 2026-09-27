// Geração de imagens de fundo do template (capa, páginas de conteúdo, contracapa) com IA.
// A geração em qualidade alta passa de um minuto (acima do timeout do Nginx), então roda em segundo plano:
// o navegador inicia o pedido e consulta o andamento. Os pedidos ficam em memória, por instância.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { UserError } from '../lib/forms';
import { openAiImagem } from '../lib/openai';

/** Proporção do A4 (210 × 297) em ~200 dpi */
const TAMANHO_A4 = '1664x2352';
const VALIDADE_MS = 15 * 60_000;
const MAX_SIMULTANEAS = 2;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const imagemFundoSchema = z.object({
  pagina: z.enum(['capa', 'miolo', 'contracapa']),
  cores: z.object({ cor_fundo: hex, cor_texto_primaria: hex, cor_texto_secundaria: hex }),
});

export type PedidoImagemFundo = z.infer<typeof imagemFundoSchema>;

const USO: Record<PedidoImagemFundo['pagina'], string> = {
  capa:
    'Front cover of the proposal. The logo and a short title will be placed over the CENTER of the page, so keep a ' +
    'calm, clean, fairly uniform area in the middle; concentrate decorative elements toward the edges and corners.',
  miolo:
    'Background for the INNER CONTENT pages, which carry dense text and price tables over the whole page. It must be ' +
    'very subtle, light and low-contrast: almost the entire page is a plain, even tone of the background color; only ' +
    'faint, delicate decorative touches near the edges or corners. Nothing may compete with text legibility.',
  contracapa:
    'Back cover of the proposal. A short closing text and the logo will be placed in the center, so keep a calm area ' +
    'in the middle and put the decorative elements toward the edges.',
};

function montarPrompt({ pagina, cores }: PedidoImagemFundo): string {
  return [
    'Full-bleed portrait A4 background artwork for a commercial proposal of a catering / buffet / events company.',
    USO[pagina],
    `Color palette: dominant background ${cores.cor_fundo}; accents inspired by ${cores.cor_texto_secundaria} and ` +
      `${cores.cor_texto_primaria}, used softly and harmoniously.`,
    'Style: elegant, refined, premium, contemporary editorial design; subtle textures (paper, watercolor, soft ' +
      'gradients, fine line botanical or culinary motifs) are welcome.',
    'The artwork must cover the whole canvas edge to edge, with no borders, frames, mockups, shadows or perspective.',
    'Absolutely no text, letters, numbers, logos, watermarks, people or faces.',
    'High resolution, crisp, print quality.',
  ].join('\n');
}

interface Geracao {
  tenantId: string;
  status: 'gerando' | 'pronto' | 'erro';
  imagem?: Buffer;
  erro?: string;
  criadoEm: number;
}

const geracoes = new Map<string, Geracao>();

function limpar(agora = Date.now()) {
  for (const [id, g] of geracoes) if (agora - g.criadoEm > VALIDADE_MS) geracoes.delete(id);
}

export function iniciarImagemFundo(tenantId: string, pedido: PedidoImagemFundo): string {
  limpar();
  const ativas = [...geracoes.values()].filter((g) => g.tenantId === tenantId && g.status === 'gerando').length;
  if (ativas >= MAX_SIMULTANEAS) throw new UserError('Já há imagens sendo geradas. Aguarde terminarem.');

  const id = randomUUID();
  const geracao: Geracao = { tenantId, status: 'gerando', criadoEm: Date.now() };
  geracoes.set(id, geracao);
  openAiImagem({ prompt: montarPrompt(pedido), tamanho: TAMANHO_A4 })
    .then((imagem) => Object.assign(geracao, { status: 'pronto', imagem }))
    .catch((err) =>
      Object.assign(geracao, {
        status: 'erro',
        erro: err instanceof UserError ? err.message : 'Não foi possível gerar a imagem.',
      })
    );
  return id;
}

/** Andamento da geração; a imagem é entregue uma única vez (depois o pedido é descartado). */
export function consultarImagemFundo(tenantId: string, id: string) {
  const g = geracoes.get(id);
  if (!g || g.tenantId !== tenantId) throw new UserError('Geração não encontrada. Tente gerar novamente.');
  if (g.status === 'gerando') return { status: g.status };
  geracoes.delete(id);
  if (g.status === 'erro') return { status: g.status, erro: g.erro };
  return { status: g.status, imagem: `data:image/jpeg;base64,${g.imagem!.toString('base64')}` };
}

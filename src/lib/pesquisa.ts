// Pesquisa de satisfação: tipos de pergunta, cálculo do NPS/CSAT e validação das respostas (puro: servidor e testes).
// Metodologia:
//   - NPS (Net Promoter Score): "o quanto recomendaria, de 0 a 10?" → promotores (9–10), neutros (7–8) e detratores (0–6);
//     NPS = % promotores − % detratores (de −100 a +100);
//   - CSAT (Customer Satisfaction): notas de 1 a 5 por aspecto → % de satisfeitos (notas 4 e 5) e média.

export type TipoPergunta = 'nps' | 'nota' | 'escolha' | 'multipla' | 'texto';

export const TIPOS_PERGUNTA: Record<TipoPergunta, string> = {
  nps: 'NPS · recomendação de 0 a 10',
  nota: 'Satisfação · nota de 1 a 5',
  escolha: 'Escolha única',
  multipla: 'Múltipla escolha',
  texto: 'Resposta aberta',
};

export const ROTULOS_NOTA = ['Muito insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito satisfeito'];

export type ClasseNps = 'promotor' | 'neutro' | 'detrator';

export const CLASSES_NPS: Record<ClasseNps, string> = { promotor: 'Promotor', neutro: 'Neutro', detrator: 'Detrator' };
export const CLASSES_NPS_PLURAL: Record<ClasseNps, string> = { promotor: 'Promotores', neutro: 'Neutros', detrator: 'Detratores' };

export const classeNps = (nota: number): ClasseNps => (nota >= 9 ? 'promotor' : nota >= 7 ? 'neutro' : 'detrator');

/** NPS de −100 a 100 (inteiro), ou null sem respostas. */
export function calcularNps(c: { promotores: number; neutros: number; detratores: number }): number | null {
  const total = c.promotores + c.neutros + c.detratores;
  return total ? Math.round(((c.promotores - c.detratores) / total) * 100) : null;
}

/** Zonas de classificação usuais do NPS. */
export function zonaNps(nps: number): { rotulo: string; tom: 'danger' | 'warning' | 'info' | 'success' } {
  if (nps < 0) return { rotulo: 'Zona crítica', tom: 'danger' };
  if (nps < 50) return { rotulo: 'Zona de aperfeiçoamento', tom: 'warning' };
  if (nps < 75) return { rotulo: 'Zona de qualidade', tom: 'info' };
  return { rotulo: 'Zona de excelência', tom: 'success' };
}

export interface PerguntaPublica {
  id: string;
  tipo: TipoPergunta;
  texto: string;
  ajuda: string | null;
  opcoes: string[];
  obrigatoria: boolean;
  ordem: number;
}

export interface RespostaValidada {
  pergunta: PerguntaPublica;
  nota: number | null;
  opcoes: string[] | null;
  texto: string | null;
}

/** Nome do campo do formulário público para a pergunta. */
export const campoPergunta = (id: string) => `p_${id}`;

const lista = (v: unknown): string[] => (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]).map((x) => String(x));

/**
 * Valida as respostas do formulário público contra o questionário: notas no intervalo, opções existentes,
 * obrigatórias preenchidas. Perguntas não respondidas (opcionais) ficam de fora. Lança Error com a mensagem.
 */
export function validarRespostas(perguntas: PerguntaPublica[], dados: Record<string, unknown>): RespostaValidada[] {
  const respostas: RespostaValidada[] = [];
  for (const p of perguntas) {
    const bruto = dados[campoPergunta(p.id)];
    const faltou = () => {
      if (p.obrigatoria) throw new Error(`Responda: “${p.texto}”`);
    };
    if (p.tipo === 'nps' || p.tipo === 'nota') {
      const s = lista(bruto)[0]?.trim() ?? '';
      if (!s) {
        faltou();
        continue;
      }
      const n = Number(s);
      const [min, max] = p.tipo === 'nps' ? [0, 10] : [1, 5];
      if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Nota inválida em “${p.texto}”.`);
      respostas.push({ pergunta: p, nota: n, opcoes: null, texto: null });
    } else if (p.tipo === 'escolha' || p.tipo === 'multipla') {
      const escolhidas = [...new Set(lista(bruto))];
      if (!escolhidas.length) {
        faltou();
        continue;
      }
      if (p.tipo === 'escolha' && escolhidas.length > 1) throw new Error(`Escolha só uma opção em “${p.texto}”.`);
      if (escolhidas.some((o) => !p.opcoes.includes(o))) throw new Error(`Opção inválida em “${p.texto}”.`);
      respostas.push({ pergunta: p, nota: null, opcoes: escolhidas, texto: null });
    } else {
      const texto = (lista(bruto)[0] ?? '').trim().slice(0, 5000);
      if (!texto) {
        faltou();
        continue;
      }
      respostas.push({ pergunta: p, nota: null, opcoes: null, texto });
    }
  }
  return respostas;
}

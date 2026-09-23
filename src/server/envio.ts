// Envio da proposta ao cliente por e-mail, com o PDF da versão em anexo.
// Assunto e mensagem partem do modelo da empresa (Configurações › Empresa) com variáveis.
import { z } from 'zod';
import type { Db } from '../lib/db';
import type { SessionUser } from '../lib/auth';
import { UserError, requiredText } from '../lib/forms';
import { escapeHtml } from '../lib/html';
import { formatMoney } from '../lib/money';
import { dataCurta } from '../lib/datas';
import { sendMail } from '../lib/mail';
import { carregarEmpresa } from './empresa';
import { pdfDaVersao } from './pdf';
import { registrarTimeline } from './timeline';

export interface RascunhoEnvio {
  numero: number;
  para: string;
  assunto: string;
  mensagem: string;
  ultimoEnvio: { em: Date; para: string } | null;
}

/** Substitui {variavel} pelos valores; variáveis desconhecidas ficam como estão. */
export function aplicarVariaveis(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, nome: string) => (nome in valores ? valores[nome] : m));
}

/** Mensagem em texto simples → HTML de e-mail (parágrafos por linha em branco, quebras preservadas). */
export function mensagemHtml(mensagem: string, empresa: string): string {
  const paragrafos = mensagem
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;font-family:Arial,sans-serif;color:#333">${paragrafos}<p style="margin:24px 0 0;font-size:12px;color:#888">Proposta enviada por ${escapeHtml(empresa)}.</p></body></html>`;
}

async function contextoEnvio(db: Db, eventoId: string, numero: number) {
  const { rows } = await db.query<{
    titulo: string | null;
    data_evento: string | null;
    cliente_nome: string | null;
    cliente_email: string | null;
    responsavel_nome: string | null;
    responsavel_email: string | null;
    valor_total: number;
    total_visivel: boolean;
    enviado_em: Date | null;
    enviado_para: string | null;
  }>(
    `SELECT e.titulo, e.data_evento::text, c.nome AS cliente_nome, c.email AS cliente_email,
            e.responsavel_nome, e.responsavel_email, v.valor_total,
            COALESCE((v.conteudo->>'mostrar_valor_total')::boolean, true) AS total_visivel,
            v.enviado_em, v.enviado_para
       FROM eventos e
       JOIN orcamentos o ON o.evento_id = e.id
       JOIN orcamento_versoes v ON v.orcamento_id = o.id AND v.numero = $2
       LEFT JOIN clientes c ON c.id = e.cliente_id
      WHERE e.id = $1`,
    [eventoId, numero]
  );
  if (!rows[0]) throw new UserError('Versão do orçamento não encontrada.');
  return rows[0];
}

export async function rascunhoEnvio(db: Db, eventoId: string, numero: number): Promise<RascunhoEnvio> {
  const [ctx, empresa] = await Promise.all([contextoEnvio(db, eventoId, numero), carregarEmpresa(db)]);
  const valores = {
    nome_cliente: ctx.responsavel_nome ?? ctx.cliente_nome ?? '',
    evento: ctx.titulo ?? 'seu evento',
    data_evento: ctx.data_evento ? dataCurta(ctx.data_evento) : 'data a definir',
    empresa: empresa.nome,
    valor_total: formatMoney(ctx.valor_total),
    versao: String(numero).padStart(2, '0'),
  };
  return {
    numero,
    para: ctx.responsavel_email ?? ctx.cliente_email ?? '',
    assunto: aplicarVariaveis(empresa.email_assunto, valores),
    mensagem: aplicarVariaveis(empresa.email_corpo, valores),
    ultimoEnvio: ctx.enviado_em ? { em: ctx.enviado_em, para: ctx.enviado_para ?? '' } : null,
  };
}

const listaEmails = z.preprocess(
  (v) =>
    String(v ?? '')
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  z.array(z.email('E-mail do destinatário inválido.')).min(1, 'Informe o e-mail do destinatário.').max(5, 'Máximo de 5 destinatários.')
);

export const envioSchema = z.object({
  numero: z.coerce.number().int().positive(),
  para: listaEmails,
  assunto: requiredText('Informe o assunto.', 255),
  mensagem: requiredText('Escreva a mensagem.', 10000),
});

export async function enviarProposta(db: Db, user: SessionUser, eventoId: string, input: z.infer<typeof envioSchema>) {
  const empresa = await carregarEmpresa(db);
  const pdf = await pdfDaVersao(db, user, eventoId, input.numero);
  const resultado = await sendMail({
    to: input.para,
    subject: input.assunto,
    html: mensagemHtml(input.mensagem, empresa.nome),
    text: input.mensagem,
    replyTo: user.email,
    attachments: [{ filename: pdf.nome, content: pdf.arquivo }],
  });
  const para = input.para.join(', ');
  await db.query(
    `UPDATE orcamento_versoes v SET enviado_em = now(), enviado_para = left($3, 255)
       FROM orcamentos o WHERE o.id = v.orcamento_id AND o.evento_id = $1 AND v.numero = $2`,
    [eventoId, input.numero, para]
  );
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId, usuarioId: user.id },
    'email_enviado',
    `Proposta (versão ${String(input.numero).padStart(2, '0')}) enviada para ${para}`,
    { para: input.para, assunto: input.assunto, entregue: resultado.delivered }
  );
  return resultado;
}

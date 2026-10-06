// Envio da proposta ao cliente por e-mail, com o PDF da versão em anexo.
// Assunto e mensagem partem dos modelos da empresa (Configurações › Modelos de e-mail) com variáveis.
import { z } from 'zod';
import type { Db } from '../lib/db';
import type { SessionUser } from '../lib/auth';
import { UserError, optionalUuid, requiredText } from '../lib/forms';
import { formatMoney } from '../lib/money';
import { dataCurta } from '../lib/datas';
import { carregarEmpresa } from './empresa';
import { aplicarVariaveis, modelosComVariaveis, type ModeloPronto } from './emailModelos';
import { listaEmails, mensagemHtml } from './emailTexto';
import { enviarNaConversa, obterOuCriarConversa } from './conversas';
import { criarNovaVersao } from './orcamento';
import { pdfDaVersao } from './pdf';
import { registrarTimeline } from './timeline';

export interface RascunhoEnvio {
  numero: number;
  para: string;
  assunto: string;
  mensagem: string;
  ultimoEnvio: { em: Date; para: string } | null;
  /** Modelos ativos com as variáveis já aplicadas (o padrão preenche assunto/mensagem) */
  modelos: ModeloPronto[];
  valorTotal: number;
  /** Versão ainda em edição: ao enviar, ela é congelada e a próxima é aberta */
  aberta: boolean;
}

export { aplicarVariaveis, mensagemHtml };

async function contextoEnvio(db: Db, eventoId: string, numero: number) {
  const { rows } = await db.query<{
    titulo: string | null;
    cliente_id: string | null;
    data_evento: string | null;
    cliente_nome: string | null;
    cliente_email: string | null;
    responsavel_nome: string | null;
    responsavel_email: string | null;
    valor_total: number;
    total_visivel: boolean;
    enviado_em: Date | null;
    enviado_para: string | null;
    congelada: boolean;
  }>(
    `SELECT e.titulo, e.cliente_id, e.data_evento::text, c.nome AS cliente_nome, c.email AS cliente_email,
            e.responsavel_nome, e.responsavel_email, v.valor_total,
            COALESCE((v.conteudo->>'mostrar_valor_total')::boolean, true) AS total_visivel,
            v.enviado_em, v.enviado_para, v.congelada
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
  const modelos = await modelosComVariaveis(db, valores);
  const padrao = modelos.find((m) => m.padrao) ?? modelos[0] ?? null;
  return {
    numero,
    para: ctx.responsavel_email ?? ctx.cliente_email ?? '',
    assunto: padrao?.assunto ?? '',
    mensagem: padrao?.corpo ?? '',
    modelos,
    ultimoEnvio: ctx.enviado_em ? { em: ctx.enviado_em, para: ctx.enviado_para ?? '' } : null,
    valorTotal: ctx.valor_total,
    aberta: !ctx.congelada,
  };
}

export const envioSchema = z.object({
  numero: z.coerce.number().int().positive(),
  modelo_id: optionalUuid(),
  para: listaEmails,
  assunto: requiredText('Informe o assunto.', 255),
  mensagem: requiredText('Escreva a mensagem.', 10000),
});

const INTERVALO_REENVIO_S = 60;

/**
 * Envia a proposta com o PDF da versão. Se a versão enviada é a que estava em edição, ela é congelada e a próxima
 * versão é aberta na mesma transação: o que o cliente recebeu não muda mais (os ajustes seguem na nova versão).
 */
export async function enviarProposta(
  db: Db,
  user: SessionUser,
  eventoId: string,
  input: z.infer<typeof envioSchema>
): Promise<{ delivered: boolean; novaVersao: number | null }> {
  const para = input.para.join(', ');
  // Duplo clique ou reenvio acidental: a mesma versão para os mesmos destinatários há poucos segundos
  const recente = await db.query(
    `SELECT 1 FROM orcamento_versoes v JOIN orcamentos o ON o.id = v.orcamento_id
      WHERE o.evento_id = $1 AND v.numero = $2 AND v.enviado_para = left($3, 255)
        AND v.enviado_em > now() - make_interval(secs => $4)`,
    [eventoId, input.numero, para, INTERVALO_REENVIO_S]
  );
  if (recente.rowCount) throw new UserError(`Esta versão acabou de ser enviada para ${para}. Aguarde um minuto para reenviar.`);

  const ctx = await contextoEnvio(db, eventoId, input.numero);
  const pdf = await pdfDaVersao(db, user, eventoId, input.numero);
  // A proposta abre (ou continua) a conversa do usuário com o cliente neste evento: as respostas chegam no Inbox
  const conversa = await obterOuCriarConversa(db, user, eventoId, {
    assunto: input.assunto,
    participantes: input.para,
    clienteId: ctx.cliente_id,
  });
  const resultado = await enviarNaConversa(db, user, conversa.id, {
    para: input.para,
    assunto: input.assunto,
    texto: input.mensagem,
    anexos: [
      {
        nome: pdf.nome,
        tipo: 'application/pdf',
        tamanho: pdf.arquivo.byteLength,
        path: `orcamentos/${eventoId}/v${input.numero}.pdf`,
        conteudo: pdf.arquivo,
      },
    ],
  });
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
    { para: input.para, assunto: input.assunto, entregue: resultado.delivered, modelo_id: input.modelo_id, conversa_id: conversa.id }
  );
  const novaVersao = ctx.congelada ? null : await criarNovaVersao(db, user, eventoId, input.numero, 'envio');
  return { delivered: resultado.delivered, novaVersao };
}

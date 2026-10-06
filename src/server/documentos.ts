// Documentos formais (contratos etc.): modelos com {variáveis} e marcação simples, gerados por evento em PDF
// com o visual de um template. Modelos são editados por owner/admin; qualquer usuário gera documentos.
import { z } from 'zod';
import type { Db } from '../lib/db';
import type { SessionUser } from '../lib/auth';
import { UserError, checkbox, optionalText, optionalUuid, requiredText } from '../lib/forms';
import { dataCurta, faixaHorario, hojeSaoPaulo } from '../lib/datas';
import { formatMoney } from '../lib/money';
import { formatarDocumento } from '../lib/documento';
import { dataPorExtenso, valorPorExtenso } from '../lib/extenso';
import { EXEMPLO_VARIAVEIS, aplicarVariaveis, camposExtras, type CampoExtra } from '../lib/documentos/variaveis';
import { signPrintToken } from '../lib/printToken';
import { readFile, saveFile } from '../lib/storage';
import { imprimir, type PdfGerado } from './pdf';
import { carregarEvento } from './eventos';
import { carregarEmpresa } from './empresa';
import { carregarTemplate, templateDaProposta, type CampoImagem, type Template } from './templates';
import { dadosComuns } from './proposta';
import { registrarTimeline } from './timeline';
import { enviarNaConversa, obterOuCriarConversa } from './conversas';
import { listaEmails } from './emailTexto';

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------
export const modeloSchema = z.object({
  nome: requiredText('Informe o nome do modelo.', 120),
  descricao: optionalText(500),
  titulo: requiredText('Informe o título do documento.', 255),
  template_id: optionalUuid(),
  corpo: requiredText('Escreva o conteúdo do documento.', 50_000),
  incluir_assinaturas: checkbox(),
  testemunhas: checkbox(),
  ativo: checkbox(),
});

export type ModeloInput = z.infer<typeof modeloSchema>;

export interface DocumentoModelo {
  id: string;
  nome: string;
  descricao: string | null;
  titulo: string;
  template_id: string | null;
  template_nome: string | null;
  corpo: string;
  incluir_assinaturas: boolean;
  testemunhas: boolean;
  ativo: boolean;
  ordem: number;
  updated_at: Date;
  /** Variáveis do texto que não são do sistema: preenchidas ao gerar */
  campos: CampoExtra[];
}

const COLUNAS_MODELO = `m.id, m.nome, m.descricao, m.titulo, m.template_id, t.nome AS template_nome, m.corpo,
            m.incluir_assinaturas, m.testemunhas, m.ativo, m.ordem, m.updated_at`;

const comCampos = <T extends { corpo: string; titulo: string }>(m: T) => ({ ...m, campos: camposExtras(m.titulo, m.corpo) });

export async function listarModelos(db: Db, opts: { busca?: string | null; somenteAtivos?: boolean } = {}): Promise<DocumentoModelo[]> {
  const { rows } = await db.query<Omit<DocumentoModelo, 'campos'>>(
    `SELECT ${COLUNAS_MODELO} FROM documento_modelos m LEFT JOIN orcamento_templates t ON t.id = m.template_id
      WHERE ($1::text IS NULL OR m.nome ILIKE $1 OR m.descricao ILIKE $1) ${opts.somenteAtivos ? 'AND m.ativo' : ''}
      ORDER BY m.ativo DESC, m.ordem, lower(m.nome)`,
    [opts.busca ?? null]
  );
  return rows.map(comCampos);
}

export async function carregarModelo(db: Db, id: string): Promise<DocumentoModelo> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new UserError('Modelo de documento não encontrado.');
  const { rows } = await db.query<Omit<DocumentoModelo, 'campos'>>(
    `SELECT ${COLUNAS_MODELO} FROM documento_modelos m LEFT JOIN orcamento_templates t ON t.id = m.template_id WHERE m.id = $1`,
    [id]
  );
  if (!rows[0]) throw new UserError('Modelo de documento não encontrado.');
  return comCampos(rows[0]);
}

async function validarTemplate(db: Db, templateId: string | null) {
  if (!templateId) return;
  // O id vem do formulário: confere no tenant antes de gravar (FK não passa pelo RLS)
  const { rowCount } = await db.query('SELECT 1 FROM orcamento_templates WHERE id = $1', [templateId]);
  if (!rowCount) throw new UserError('Template não encontrado.', 'template_id');
}

export async function salvarModelo(db: Db, tenantId: string, id: string | null, input: ModeloInput): Promise<string> {
  await validarTemplate(db, input.template_id);
  const values = [input.nome, input.descricao, input.titulo, input.template_id, input.corpo, input.incluir_assinaturas, input.testemunhas, input.ativo];
  if (id) {
    const res = await db.query(
      `UPDATE documento_modelos SET nome = $1, descricao = $2, titulo = $3, template_id = $4, corpo = $5,
              incluir_assinaturas = $6, testemunhas = $7, ativo = $8, updated_at = now()
        WHERE id = $9`,
      [...values, id]
    );
    if (!res.rowCount) throw new UserError('Modelo de documento não encontrado.');
    return id;
  }
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO documento_modelos (nome, descricao, titulo, template_id, corpo, incluir_assinaturas, testemunhas, ativo, tenant_id, ordem)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (SELECT COALESCE(max(ordem), 0) + 1 FROM documento_modelos)) RETURNING id`,
    [...values, tenantId]
  );
  return rows[0].id;
}

export async function duplicarModelo(db: Db, tenantId: string, id: string): Promise<string> {
  const m = await carregarModelo(db, id);
  const { rows } = await db.query<{ n: number }>(`SELECT count(*) AS n FROM documento_modelos WHERE lower(nome) LIKE lower($1) || '%'`, [`${m.nome} (cópia`]);
  const nome = `${m.nome} (cópia${rows[0].n ? ` ${rows[0].n + 1}` : ''})`.slice(0, 120);
  return salvarModelo(db, tenantId, null, {
    nome, descricao: m.descricao, titulo: m.titulo, template_id: m.template_id, corpo: m.corpo,
    incluir_assinaturas: m.incluir_assinaturas, testemunhas: m.testemunhas, ativo: false,
  });
}

export async function excluirModelo(db: Db, id: string): Promise<void> {
  const res = await db.query('DELETE FROM documento_modelos WHERE id = $1', [id]);
  if (!res.rowCount) throw new UserError('Modelo de documento não encontrado.');
}

// ---------------------------------------------------------------------------
// Variáveis a partir do evento
// ---------------------------------------------------------------------------
export async function valoresDoEvento(db: Db, eventoId: string): Promise<Record<string, string>> {
  const [e, empresa] = await Promise.all([carregarEvento(db, eventoId), carregarEmpresa(db)]);
  const { rows: cli } = await db.query<{ endereco: string | null }>('SELECT endereco FROM clientes WHERE id = $1', [e.cliente_id]);
  const { rows: orc } = await db.query<{ versao_atual: number; valor_total: number }>(
    'SELECT versao_atual, valor_total FROM orcamentos WHERE evento_id = $1',
    [eventoId]
  );
  const valor = orc[0]?.valor_total ?? e.valor_orcamento ?? null;
  const hoje = hojeSaoPaulo();
  const v = (x: string | number | null | undefined) => (x === null || x === undefined ? '' : String(x));
  return {
    empresa: empresa.nome,
    empresa_razao_social: empresa.razao_social ?? empresa.nome,
    empresa_documento: formatarDocumento(empresa.documento),
    empresa_endereco: v(empresa.endereco),
    empresa_email: v(empresa.email),
    empresa_telefone: v(empresa.telefone),
    assinante_nome: empresa.assinatura_nome ?? empresa.nome,
    assinante_cargo: v(empresa.assinatura_cargo),

    cliente: v(e.cliente_nome),
    cliente_documento: formatarDocumento(e.cliente_documento),
    cliente_email: v(e.cliente_email),
    cliente_telefone: v(e.cliente_telefone),
    cliente_endereco: v(cli[0]?.endereco),
    responsavel: e.responsavel_nome ?? v(e.cliente_nome),
    responsavel_email: e.responsavel_email ?? v(e.cliente_email),
    responsavel_whatsapp: e.responsavel_whatsapp ?? v(e.cliente_telefone),

    evento: e.titulo ?? 'Evento',
    data_evento: e.data_evento ? dataCurta(e.data_evento) : '',
    data_evento_extenso: dataPorExtenso(e.data_evento),
    hora_inicio: v(e.hora_inicio),
    hora_fim: v(e.hora_fim),
    horario: e.hora_inicio ? faixaHorario(e.hora_inicio, e.hora_fim) : '',
    convidados: v(e.numero_convidados),
    local: e.espaco_nome ?? e.local_nome ?? '',
    endereco_evento: v(e.endereco),
    tipo_evento: v(e.tipo_nome),
    ocasiao: v(e.categoria_nome),
    formato_servico: v(e.formato_nome),

    valor_total: valor !== null ? formatMoney(valor) : '',
    valor_total_extenso: valor !== null ? valorPorExtenso(valor) : '',
    versao_orcamento: orc[0] ? String(orc[0].versao_atual).padStart(2, '0') : '',
    forma_pagamento: v(e.forma_pagamento),

    data_hoje: dataCurta(hoje),
    data_hoje_extenso: dataPorExtenso(hoje),
  };
}

// ---------------------------------------------------------------------------
// Documentos gerados
// ---------------------------------------------------------------------------
export interface Documento {
  id: string;
  evento_id: string;
  evento_titulo: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_documento: string | null;
  modelo_id: string | null;
  modelo_nome: string | null;
  template_id: string | null;
  ano: number;
  numero: number;
  titulo: string;
  corpo: string;
  campos: Record<string, string>;
  incluir_assinaturas: boolean;
  testemunhas: boolean;
  pdf_path: string | null;
  pdf_gerado_em: Date | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  created_at: Date;
}

export const numeroDocumento = (d: Pick<Documento, 'ano' | 'numero'>) => `${d.ano}/${String(d.numero).padStart(4, '0')}`;

const COLUNAS_DOC = `d.id, d.evento_id, e.titulo AS evento_titulo, d.cliente_id, c.nome AS cliente_nome, c.documento AS cliente_documento,
            d.modelo_id, d.modelo_nome, d.template_id, d.ano, d.numero, d.titulo, d.corpo, d.campos, d.incluir_assinaturas,
            d.testemunhas, d.pdf_path, d.pdf_gerado_em, d.criado_por, u.nome AS criado_por_nome, d.created_at`;
const FROM_DOC = `FROM documentos d JOIN eventos e ON e.id = d.evento_id
            LEFT JOIN clientes c ON c.id = COALESCE(d.cliente_id, e.cliente_id)
            LEFT JOIN usuarios u ON u.id = d.criado_por`;

export async function listarDocumentosDoEvento(db: Db, eventoId: string): Promise<Documento[]> {
  const { rows } = await db.query<Documento>(`SELECT ${COLUNAS_DOC} ${FROM_DOC} WHERE d.evento_id = $1 ORDER BY d.created_at DESC`, [eventoId]);
  return rows;
}

export async function carregarDocumento(db: Db, id: string): Promise<Documento> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new UserError('Documento não encontrado.');
  const { rows } = await db.query<Documento>(`SELECT ${COLUNAS_DOC} ${FROM_DOC} WHERE d.id = $1`, [id]);
  if (!rows[0]) throw new UserError('Documento não encontrado.');
  return rows[0];
}

export interface GerarInput {
  modeloId: string;
  templateId: string | null;
  /** Valores dos campos extras do modelo (chave → valor digitado) */
  campos: Record<string, string>;
}

/** Lê os campos extras do formulário (campo_<chave>=valor). */
export function camposDoFormulario(data: Record<string, unknown>): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('campo_') && typeof v === 'string') campos[k.slice(6).toLowerCase()] = v.trim().slice(0, 2000);
  }
  return campos;
}

/**
 * Cria o documento: aplica as variáveis do evento e os campos extras ao modelo, numera por empresa/ano e grava o
 * texto final (com o template escolhido, o do modelo ou o padrão da empresa). O PDF é impresso depois, em outra
 * transação (`gerarPdfDocumento`): a página /print/documento/:id só enxerga o documento depois do commit.
 */
export async function criarDocumento(db: Db, user: SessionUser, eventoId: string, input: GerarInput): Promise<Documento> {
  const modelo = await carregarModelo(db, input.modeloId);
  const template = await templateDaProposta(db, input.templateId ?? modelo.template_id);
  const faltando = modelo.campos.filter((c) => !input.campos[c.chave]?.trim());
  if (faltando.length) throw new UserError(`Preencha: ${faltando.map((c) => c.rotulo).join(', ')}.`, `campo_${faltando[0].chave}`);
  const extras = Object.fromEntries(modelo.campos.map((c) => [c.chave, input.campos[c.chave].trim()]));

  const ano = Number(hojeSaoPaulo().slice(0, 4));
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`documentos:${user.tenantId}:${ano}`]);
  const { rows: seq } = await db.query<{ n: number }>('SELECT COALESCE(max(numero), 0) + 1 AS n FROM documentos WHERE ano = $1', [ano]);
  const numero = Number(seq[0].n);
  const evento = await carregarEvento(db, eventoId);
  const valores = { ...(await valoresDoEvento(db, eventoId)), numero_documento: numeroDocumento({ ano, numero }), ...extras };
  const titulo = aplicarVariaveis(modelo.titulo, valores).slice(0, 255);
  const corpo = aplicarVariaveis(modelo.corpo, valores);

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO documentos (tenant_id, evento_id, cliente_id, modelo_id, template_id, ano, numero, titulo, modelo_nome, corpo, campos,
                             incluir_assinaturas, testemunhas, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
    [user.tenantId, eventoId, evento.cliente_id, modelo.id, template.id, ano, numero, titulo, modelo.nome, corpo, JSON.stringify(extras),
     modelo.incluir_assinaturas, modelo.testemunhas, user.id]
  );
  const id = rows[0].id;
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId, usuarioId: user.id },
    'documento_gerado',
    `Documento ${numeroDocumento({ ano, numero })} gerado: ${titulo}`,
    { documento_id: id, modelo_id: modelo.id }
  );
  return carregarDocumento(db, id);
}

const nomeArquivo = (d: Documento) => `${d.titulo.replace(/[\\/:*?"<>|]/g, '-')} - ${d.ano}-${String(d.numero).padStart(4, '0')}.pdf`;

/** Imprime (ou reimprime) o PDF do documento a partir do texto final e guarda em disco. */
export async function gerarPdfDocumento(db: Db, tenantId: string, id: string): Promise<PdfGerado> {
  const d = await carregarDocumento(db, id);
  const token = await signPrintToken({ tenantId, alvo: 'documento', id });
  const arquivo = await imprimir(`/print/documento/${id}`, token, ['miolo'], d.titulo);
  const caminho = `documentos/${d.evento_id}/${id}.pdf`;
  await saveFile(tenantId, caminho, arquivo);
  await db.query('UPDATE documentos SET pdf_path = $1, pdf_gerado_em = now() WHERE id = $2', [caminho, id]);
  return { arquivo, nome: nomeArquivo(d) };
}

/** PDF do documento: o arquivo guardado; se faltar (ex.: falha na impressão ou volume limpo), imprime de novo. */
export async function pdfDoDocumento(db: Db, tenantId: string, id: string): Promise<PdfGerado> {
  const d = await carregarDocumento(db, id);
  if (d.pdf_path) {
    const existente = await readFile(tenantId, d.pdf_path);
    if (existente) return { arquivo: new Uint8Array(existente), nome: nomeArquivo(d) };
  }
  return gerarPdfDocumento(db, tenantId, id);
}

/** PDF de exemplo de um modelo (dados fictícios), para conferir o texto e o visual. */
export async function pdfExemploModelo(db: Db, tenantId: string, modeloId: string): Promise<PdfGerado> {
  const m = await carregarModelo(db, modeloId);
  const token = await signPrintToken({ tenantId, alvo: 'documento', id: `exemplo:${modeloId}` });
  const arquivo = await imprimir(`/print/documento/exemplo:${modeloId}`, token, ['miolo'], `Exemplo - ${m.nome}`);
  return { arquivo, nome: `Exemplo - ${m.nome}.pdf` };
}

/** Exclui o documento e devolve o caminho do PDF para a página remover do disco. */
export async function excluirDocumento(db: Db, user: SessionUser, id: string): Promise<string | null> {
  const d = await carregarDocumento(db, id);
  await db.query('DELETE FROM documentos WHERE id = $1', [id]);
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId: d.evento_id, usuarioId: user.id },
    'editado',
    `Documento ${numeroDocumento(d)} excluído: ${d.titulo}`
  );
  return d.pdf_path;
}

export const envioDocumentoSchema = z.object({
  para: listaEmails,
  assunto: requiredText('Informe o assunto.', 255),
  texto: requiredText('Escreva a mensagem.', 10_000),
  modelo_id: optionalUuid(),
});

/** Envia o PDF do documento por e-mail dentro da conversa do evento (Inbox). */
export async function enviarDocumento(
  db: Db,
  user: SessionUser,
  id: string,
  input: z.infer<typeof envioDocumentoSchema>
): Promise<{ delivered: boolean; conversaId: string }> {
  const d = await carregarDocumento(db, id);
  const pdf = await pdfDoDocumento(db, user.tenantId, id);
  const conversa = await obterOuCriarConversa(db, user, d.evento_id, { assunto: input.assunto, participantes: input.para, clienteId: d.cliente_id });
  const r = await enviarNaConversa(db, user, conversa.id, {
    para: input.para,
    assunto: input.assunto,
    texto: input.texto,
    rodape: `Documento enviado por ${user.nome}.`,
    anexos: [{ nome: pdf.nome, tipo: 'application/pdf', tamanho: pdf.arquivo.byteLength, path: d.pdf_path, conteudo: pdf.arquivo }],
  });
  await registrarTimeline(
    db,
    { tenantId: user.tenantId, eventoId: d.evento_id, usuarioId: user.id },
    'email_enviado',
    `Documento ${numeroDocumento(d)} enviado para ${input.para.join(', ')}`,
    { documento_id: id, conversa_id: conversa.id, entregue: r.delivered }
  );
  return { delivered: r.delivered, conversaId: conversa.id };
}

// ---------------------------------------------------------------------------
// Impressão
// ---------------------------------------------------------------------------
export interface DocumentoView {
  template: Template;
  imagens: Record<CampoImagem, string | null>;
  titulo: string;
  numero: string;
  corpo: string;
  incluir_assinaturas: boolean;
  testemunhas: boolean;
  data: string;
  empresa: { nome: string; razao_social: string; documento: string; assinante: string; cargo: string | null };
  cliente: { nome: string; documento: string };
}

async function viewBase(db: Db, tenantId: string, template: Template, valores: Record<string, string>) {
  const comuns = await dadosComuns(db, tenantId, template);
  return {
    template,
    imagens: comuns.imagens,
    data: valores.data_hoje_extenso,
    empresa: {
      nome: valores.empresa,
      razao_social: valores.empresa_razao_social,
      documento: valores.empresa_documento,
      assinante: valores.assinante_nome,
      cargo: valores.assinante_cargo || null,
    },
    cliente: { nome: valores.cliente, documento: valores.cliente_documento },
  };
}

/** Documento gerado, para a página /print/documento/:id. */
export async function montarDocumentoView(db: Db, tenantId: string, id: string): Promise<DocumentoView> {
  const d = await carregarDocumento(db, id);
  const template = d.template_id ? await carregarTemplate(db, d.template_id).catch(() => templateDaProposta(db, null)) : await templateDaProposta(db, null);
  const empresa = await carregarEmpresa(db);
  const valores = {
    data_hoje_extenso: dataPorExtenso(d.created_at.toISOString().slice(0, 10)),
    empresa: empresa.nome,
    empresa_razao_social: empresa.razao_social ?? empresa.nome,
    empresa_documento: formatarDocumento(empresa.documento),
    assinante_nome: empresa.assinatura_nome ?? empresa.nome,
    assinante_cargo: empresa.assinatura_cargo ?? '',
    cliente: d.cliente_nome ?? '',
    cliente_documento: formatarDocumento(d.cliente_documento),
  };
  return {
    ...(await viewBase(db, tenantId, template, valores)),
    titulo: d.titulo,
    numero: numeroDocumento(d),
    corpo: d.corpo,
    incluir_assinaturas: d.incluir_assinaturas,
    testemunhas: d.testemunhas,
  };
}

/** Exemplo de um modelo com dados fictícios (campos extras aparecem como [chave]). */
export async function montarDocumentoExemplo(db: Db, tenantId: string, modeloId: string): Promise<DocumentoView> {
  const m = await carregarModelo(db, modeloId);
  const template = await templateDaProposta(db, m.template_id);
  const valores: Record<string, string> = { ...EXEMPLO_VARIAVEIS };
  for (const c of m.campos) valores[c.chave] = `[${c.rotulo}]`;
  return {
    ...(await viewBase(db, tenantId, template, valores)),
    titulo: aplicarVariaveis(m.titulo, valores),
    numero: valores.numero_documento,
    corpo: aplicarVariaveis(m.corpo, valores),
    incluir_assinaturas: m.incluir_assinaturas,
    testemunhas: m.testemunhas,
  };
}

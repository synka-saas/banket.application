// Dados para renderizar a proposta (HTML de impressão → PDF).
import type { Db } from '../lib/db';
import { contentTypeFor, readFile } from '../lib/storage';
import { dataCurta } from '../lib/datas';
import { calcularOrcamento, novaChave, type ConteudoOrcamento } from '../lib/calculo/orcamento';
import { CAMPOS_IMAGEM, listarBlocos, templateDaProposta, carregarTemplate, type CampoImagem, type Template } from './templates';
import { carregarVersao, faixasLocacao } from './orcamento';

export interface PropostaView {
  template: Template;
  imagens: Record<CampoImagem, string | null>;
  empresa: { nome: string; telefone: string | null; email: string | null };
  assinatura: { nome: string | null; cargo: string | null; telefone: string | null };
  conteudo: ConteudoOrcamento;
  numeroVersao: number;
  dataProposta: string;
}

async function dataUri(tenantId: string, path: string | null): Promise<string | null> {
  if (!path) return null;
  const arquivo = await readFile(tenantId, path);
  return arquivo ? `data:${contentTypeFor(path)};base64,${arquivo.toString('base64')}` : null;
}

async function dadosComuns(db: Db, tenantId: string, template: Template) {
  const { rows } = await db.query<{
    nome: string; telefone: string | null; email: string | null; logo_path: string | null;
    assinatura_nome: string | null; assinatura_cargo: string | null; assinatura_telefone: string | null;
  }>(
    `SELECT t.nome, t.telefone, t.email, t.logo_path, c.assinatura_nome, c.assinatura_cargo, c.assinatura_telefone
       FROM tenants t LEFT JOIN configuracoes_tenant c ON c.tenant_id = t.id`
  );
  const e = rows[0];
  const imagens = {} as Record<CampoImagem, string | null>;
  for (const campo of CAMPOS_IMAGEM) imagens[campo] = await dataUri(tenantId, template[campo]);
  // Sem logo no template, usa o logotipo da empresa
  if (!imagens.logo_path) imagens.logo_path = await dataUri(tenantId, e?.logo_path ?? null);
  return {
    imagens,
    empresa: { nome: e?.nome ?? '', telefone: e?.telefone ?? null, email: e?.email ?? null },
    assinatura: { nome: e?.assinatura_nome ?? null, cargo: e?.assinatura_cargo ?? null, telefone: e?.assinatura_telefone ?? null },
  };
}

function hojeISO(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

/** Proposta de uma versão real do orçamento. */
export async function montarProposta(db: Db, tenantId: string, versaoId: string): Promise<PropostaView> {
  const { rows } = await db.query<{ evento_id: string; numero: number; template_id: string | null; congelada: boolean; updated_at: Date }>(
    `SELECT o.evento_id, v.numero, o.template_id, v.congelada, v.updated_at
       FROM orcamento_versoes v JOIN orcamentos o ON o.id = v.orcamento_id WHERE v.id = $1`,
    [versaoId]
  );
  if (!rows[0]) throw new Error('Versão não encontrada');
  const versao = await carregarVersao(db, rows[0].evento_id, rows[0].numero);
  const template = await templateDaProposta(db, rows[0].template_id);
  const data = rows[0].congelada ? new Date(rows[0].updated_at).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) : hojeISO();
  return {
    template,
    ...(await dadosComuns(db, tenantId, template)),
    conteudo: versao.conteudo,
    numeroVersao: versao.numero,
    dataProposta: dataCurta(data),
  };
}

/** Proposta de exemplo para pré-visualizar um template. */
export async function montarPropostaExemplo(db: Db, tenantId: string, templateId: string): Promise<PropostaView> {
  const template = await carregarTemplate(db, templateId);
  const blocos = await listarBlocos(db);
  const { rows: opcao } = await db.query<{ id: string }>(`SELECT id FROM cardapio_opcoes WHERE ativo ORDER BY lower(nome) LIMIT 1`);
  const k = () => novaChave('x');
  const conteudo = calcularOrcamento(
    {
      cabecalho: {
        evento: 'Casamento Ana & Pedro', cliente: 'Ana Souza', contato: 'Ana Souza', telefone: '(11) 99999-0000',
        data_evento: '20/11/2027', horario: '19h às 00h', local: 'Nosso espaço', formato_servico: 'Buffet',
        duracao_evento: '5 horas', duracao_alimentacao: '2 horas',
      },
      pagantes: { convidados: 120, criancas_meia: 8, criancas_isentas: 4 },
      cardapios: [
        {
          key: k(), opcao_id: opcao[0]?.id ?? null, nome: 'Coquetel de recepção', preco_base: 55, preco_pp_manual: null, subtotal_manual: null,
          secoes: [
            {
              key: k(), secao_id: null, nome: 'Finger foods', escolha_qtd: 3, preco_catalogo: null, preco_manual: null,
              itens: ['Bruschetta de tomate, manjericão e parmesão', 'Dadinho de tapioca com geleia de pimenta', 'Steak tartar', 'Polenta cremosa com ragú de linguiça']
                .map((nome) => ({ key: k(), item_id: null, nome, descricao: null, selecionado: true, preco_catalogo: null, preco_manual: null, restricoes: [] })),
            },
          ],
        },
        {
          key: k(), opcao_id: null, nome: 'Jantar empratado', preco_base: 160, preco_pp_manual: null, subtotal_manual: null,
          secoes: [
            {
              key: k(), secao_id: null, nome: 'Entradas', escolha_qtd: 1, preco_catalogo: null, preco_manual: null,
              itens: [
                { nome: 'Salada Caprese', descricao: 'Tomate italiano assado, mozzarella de búfala, rúcula e pesto' },
                { nome: 'Polenta branca cremosa', descricao: 'Com cogumelos frescos flambados' },
              ].map((i) => ({ key: k(), item_id: null, ...i, selecionado: true, preco_catalogo: null, preco_manual: null, restricoes: [] })),
            },
            {
              key: k(), secao_id: null, nome: 'Prato principal', escolha_qtd: 1, preco_catalogo: null, preco_manual: null,
              itens: [
                { nome: 'Risoto de pêra, nozes e gorgonzola', descricao: null },
                { nome: 'Bife de chorizo com batatas rústicas', descricao: 'Ao molho chimichurri, vinagrete da casa e farofa de alho' },
              ].map((i) => ({ key: k(), item_id: null, ...i, selecionado: true, preco_catalogo: null, preco_manual: null, restricoes: [] })),
            },
          ],
        },
      ],
      bebidas: [
        { key: k(), ref_id: null, nome: 'Soft drinks', descricao: 'Água, refrigerantes e suco de laranja', unidade: 'pessoa', quantidade: 0, preco_catalogo: 20, preco_manual: null, subtotal_manual: null },
        { key: k(), ref_id: null, nome: 'Chope artesanal – barril 50 litros', descricao: null, unidade: 'unidade', quantidade: 2, preco_catalogo: 900, preco_manual: null, subtotal_manual: null },
      ],
      staff: [
        { key: k(), servico_id: null, funcao: 'Garçom', regra: { cache_diaria: 250, auxilio: 0, por_evento: false, quantidade_fixa: 1, convidados_por_profissional: 15, minimo: 0 }, quantidade_manual: null, valor_unit_manual: null },
        { key: k(), servico_id: null, funcao: 'Chef de cozinha', regra: { cache_diaria: 450, auxilio: 0, por_evento: true, quantidade_fixa: 1, convidados_por_profissional: null, minimo: 0 }, quantidade_manual: null, valor_unit_manual: null },
      ],
      locacao: { incluir: true, faixa_id: null, descricao: null, valor_manual: null },
      extras: [{ key: k(), descricao: 'Taxa de cerimônia no local', quantidade: 1, valor_unit: 500 }],
      informacoes_complementares: [
        { key: k(), titulo: 'Logística e cronograma', auto: null, linhas: [
          { key: k(), label: 'Início do serviço', valor: '19:00', auto: null },
          { key: k(), label: 'Encerramento do serviço', valor: '00:00', auto: null },
        ] },
      ],
      condicoes_gerais: [
        { key: k(), titulo: 'Condições financeiras', auto: null, linhas: [
          { key: k(), label: 'Prazo de validade da proposta', valor: '5 dias corridos', auto: null },
        ] },
      ],
      blocos_texto: blocos.filter((b) => b.ativo_por_padrao).map((b) => ({ key: k(), bloco_id: b.id, titulo: b.titulo, texto: b.texto, pagina: b.pagina })),
      total_manual: null,
      mostrar_valor_total: true,
      observacoes: null,
    },
    await faixasLocacao(db)
  );
  return {
    template,
    ...(await dadosComuns(db, tenantId, template)),
    conteudo,
    numeroVersao: 1,
    dataProposta: dataCurta(hojeISO()),
  };
}

// Avisos à empresa pelo WhatsApp (recurso busca_aviso_whatsapp: Perfil Personalizado). O número, o aceite e os tipos de
// aviso ficam em Configurações › Empresa (configuracoes_tenant.whatsapp_avisos*). Cada envio vira uma linha em
// whatsapp_mensagens (dedup por `chave`); a chamada à Meta fica fora da transação. Melhor esforço: nunca falha quem chama.
import { withTenant, type Db } from '../lib/db';
import { podeUsar } from '../lib/planos/gating';
import { TEMPLATES, enviarTemplate, numeroWhatsapp, parametro, type TipoAviso } from '../lib/whatsapp';

export const TIPOS_AVISO: { valor: Exclude<TipoAviso, 'teste'>; rotulo: string; descricao: string }[] = [
  { valor: 'novo_pedido', rotulo: 'Novo pedido', descricao: 'Pedido de orçamento pelo Banket Busca ou por um formulário de captação.' },
  { valor: 'prazo_resposta', rotulo: 'Prazo de resposta vencendo', descricao: 'Pedido sem resposta quando faltam 25% do seu tempo de resposta (prazos acima de 12 horas).' },
  { valor: 'inbox', rotulo: 'Resposta do cliente no Inbox', descricao: 'O cliente respondeu um e-mail de uma conversa.' },
  { valor: 'pesquisa', rotulo: 'Pesquisa de satisfação respondida', descricao: 'Com o NPS e a nota média.' },
];

export interface ConfigWhatsapp {
  numero: string | null;
  ativo: boolean;
  tipos: string[];
}

export async function configWhatsapp(db: Db): Promise<ConfigWhatsapp> {
  const { rows } = await db.query<{ whatsapp_avisos: string | null; whatsapp_avisos_ativo: boolean; whatsapp_avisos_tipos: string[] }>(
    'SELECT whatsapp_avisos, whatsapp_avisos_ativo, whatsapp_avisos_tipos FROM configuracoes_tenant'
  );
  const c = rows[0];
  return { numero: c?.whatsapp_avisos ?? null, ativo: c?.whatsapp_avisos_ativo ?? false, tipos: c?.whatsapp_avisos_tipos ?? [] };
}

export interface Aviso {
  /** Variáveis do corpo do template, na ordem */
  variaveis: (string | number | null | undefined)[];
  /** Caminho do app aberto pelo botão (ex.: eventos/<id>) */
  link: string | null;
  eventoId?: string | null;
  /** Dedup: o mesmo aviso não sai duas vezes */
  chave?: string | null;
}

/** Envia um aviso se a empresa tem o recurso, ativou os avisos e escolheu este tipo. Devolve o que aconteceu. */
export async function avisarWhatsapp(tenantId: string, tipo: TipoAviso, aviso: Aviso): Promise<'enviado' | 'ignorado' | 'falhou'> {
  try {
    if (!(await podeUsar(tenantId, 'busca_aviso_whatsapp'))) return 'ignorado';
    const t = TEMPLATES[tipo];
    const variaveis = aviso.variaveis.slice(0, t.variaveis).map((v) => parametro(v, tipo === 'inbox' ? 200 : 120));
    while (variaveis.length < t.variaveis) variaveis.push('—');
    const registro = await withTenant(tenantId, async (db) => {
      const cfg = await configWhatsapp(db);
      const para = numeroWhatsapp(cfg.numero);
      if (!para || (tipo !== 'teste' && (!cfg.ativo || !cfg.tipos.includes(tipo)))) return null;
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO whatsapp_mensagens (tenant_id, tipo, chave, para, template, evento_id)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (tenant_id, chave) WHERE chave IS NOT NULL DO NOTHING RETURNING id`,
        [tenantId, tipo, aviso.chave ?? null, para, t.nome, aviso.eventoId ?? null]
      );
      return rows[0] ? { id: rows[0].id, para } : null;
    });
    if (!registro) return 'ignorado';
    const r = await enviarTemplate({ para: registro.para, template: t.nome, variaveis, link: aviso.link });
    await withTenant(tenantId, (db) =>
      db.query(`UPDATE whatsapp_mensagens SET status = $2, wamid = $3, erro = $4, status_em = now() WHERE id = $1`, [
        registro.id,
        r.ok ? (r.registrado ? 'registrada' : 'enviada') : 'falhou',
        r.ok ? r.wamid : null,
        r.ok ? null : r.erro,
      ])
    );
    if (!r.ok) console.error(`[whatsapp] ${t.nome} falhou:`, r.erro);
    return r.ok ? 'enviado' : 'falhou';
  } catch (err) {
    console.error('[whatsapp] aviso falhou:', err);
    return 'falhou';
  }
}

export interface MensagemWhatsapp {
  tipo: string;
  status: string;
  erro: string | null;
  created_at: Date;
}

/** Últimos avisos (Configurações › Empresa). */
export async function ultimosAvisos(db: Db, limite = 5): Promise<MensagemWhatsapp[]> {
  return (await db.query<MensagemWhatsapp>('SELECT tipo, status, erro, created_at FROM whatsapp_mensagens ORDER BY created_at DESC LIMIT $1', [limite])).rows;
}

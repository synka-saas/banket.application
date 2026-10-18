#!/usr/bin/env node
// Templates do WhatsApp (Cloud API da Meta) usados nos avisos do Banket (src/lib/whatsapp.ts → TEMPLATES). Idempotente:
// cria só os que ainda não existem na conta do WhatsApp Business e mostra a situação de cada um (a Meta aprova em minutos
// a algumas horas; enquanto não estiver APPROVED o envio falha e fica registrado em whatsapp_mensagens).
//
//   node scripts/whatsapp-templates.mjs            # cria os que faltam e lista a situação
//   node scripts/whatsapp-templates.mjs --status   # só lista
//   node scripts/whatsapp-templates.mjs --dry-run  # mostra o que criaria
//
// Lê WHATSAPP_TOKEN, WHATSAPP_WABA_ID, WHATSAPP_API_VERSION e APP_URL do ambiente ou do .env. O token precisa da
// permissão whatsapp_business_management (token permanente de usuário do sistema).
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));

function env(nome) {
  if (process.env[nome]) return process.env[nome];
  const arquivo = `${ROOT}/.env`;
  if (!existsSync(arquivo)) return '';
  let valor = '';
  for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === nome && m[2].trim()) valor = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return valor;
}

const TOKEN = env('WHATSAPP_TOKEN');
const WABA = env('WHATSAPP_WABA_ID');
const VERSAO = env('WHATSAPP_API_VERSION') || 'v23.0';
const APP_URL = (env('APP_URL') || 'https://app.banket.com.br').replace(/\/$/, '');

// Corpo com {{n}}; exemplos na mesma ordem. Nenhum corpo começa ou termina com variável (regra da Meta).
const TEMPLATES = [
  {
    name: 'banket_novo_pedido',
    corpo: 'Novo pedido de orçamento no Banket.\n\nCliente: {{1}}\nEvento: {{2}}\nData: {{3}}\nConvidados: {{4}}\nOrigem: {{5}}\n\nResponda em até {{6}} para manter o seu tempo de resposta.',
    exemplos: ['Mariana Souza', 'Casamento', '12/05/2027', '120', 'Banket Busca', '48 horas'],
    botao: 'Abrir pedido', exemploLink: 'eventos/3f2c9a1e-0000-4000-8000-000000000000',
  },
  {
    name: 'banket_prazo_resposta',
    corpo: 'O pedido de {{1}} ({{2}}) ainda está sem resposta no Banket. Faltam {{3}} para terminar o seu tempo de resposta.',
    exemplos: ['Mariana Souza', 'Casamento', '12 horas'],
    botao: 'Responder pedido', exemploLink: 'eventos/3f2c9a1e-0000-4000-8000-000000000000',
  },
  {
    name: 'banket_resposta_cliente',
    corpo: 'Nova resposta de {{1}} na conversa sobre {{2}}:\n\n"{{3}}"\n\nResponda pelo Inbox do Banket.',
    exemplos: ['Mariana Souza', 'Casamento – Mariana Souza', 'Podemos marcar a degustação para sábado?'],
    botao: 'Abrir conversa', exemploLink: 'inbox/3f2c9a1e-0000-4000-8000-000000000000',
  },
  {
    name: 'banket_pesquisa_respondida',
    corpo: 'A pesquisa de satisfação foi respondida por {{1}}, do evento {{2}}.\n\nResultado: {{3}}.\n\nVeja os detalhes no Banket.',
    exemplos: ['Mariana Souza', 'Casamento – Mariana Souza', 'NPS 9 · nota média 4,8'],
    botao: 'Ver resposta', exemploLink: 'pesquisas/respostas/3f2c9a1e-0000-4000-8000-000000000000',
  },
  {
    name: 'banket_avisos_ativados',
    corpo: 'Os avisos do Banket estão ativos para {{1}}. Você vai receber aqui os avisos escolhidos em Configurações › Empresa.',
    exemplos: ['Buffet Exemplo'],
    botao: 'Abrir configurações', exemploLink: 'configuracoes/empresa',
  },
];

async function graph(caminho, opcoes = {}) {
  const res = await fetch(`https://graph.facebook.com/${VERSAO}/${caminho}`, {
    ...opcoes,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${json.error?.message ?? ''} ${json.error?.error_user_msg ?? ''}`.trim());
  return json;
}

function payload(t) {
  return {
    name: t.name,
    language: 'pt_BR',
    category: 'UTILITY',
    components: [
      { type: 'BODY', text: t.corpo, example: { body_text: [t.exemplos] } },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: t.botao, url: `${APP_URL}/{{1}}`, example: [`${APP_URL}/${t.exemploLink}`] }] },
    ],
  };
}

if (!TOKEN || !WABA) {
  console.error('Defina WHATSAPP_TOKEN e WHATSAPP_WABA_ID no .env (ver CLAUDE.md › Variáveis de ambiente).');
  process.exit(1);
}

const { data: existentes = [] } = await graph(`${WABA}/message_templates?fields=name,status,language,category,rejected_reason&limit=200`);
const porNome = new Map(existentes.filter((t) => t.language === 'pt_BR').map((t) => [t.name, t]));

for (const t of TEMPLATES) {
  const atual = porNome.get(t.name);
  if (atual) {
    console.log(`${t.name}: ${atual.status}${atual.rejected_reason && atual.rejected_reason !== 'NONE' ? ` (${atual.rejected_reason})` : ''}`);
    continue;
  }
  if (args.has('--status')) {
    console.log(`${t.name}: não criado`);
    continue;
  }
  if (args.has('--dry-run')) {
    console.log(`${t.name}: criaria`, JSON.stringify(payload(t)));
    continue;
  }
  try {
    const r = await graph(`${WABA}/message_templates`, { method: 'POST', body: JSON.stringify(payload(t)) });
    console.log(`${t.name}: criado (${r.status ?? 'PENDING'})`);
  } catch (err) {
    console.error(`${t.name}: falhou — ${err.message}`);
    process.exitCode = 1;
  }
}

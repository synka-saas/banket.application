#!/usr/bin/env node
// Importa a base de buffets (CSV com ";" da coleta do Google Maps + sites) para o Banket Busca. Uma empresa (tenant,
// origem 'importacao', plano Busca, sem usuário) por rede; um perfil publicado por unidade; um espaço por unidade com
// espaço próprio. Só entram linhas relevantes, do ramo (buffet/catering) e com nome e ao menos um contato válido.
//
//   node scripts/importar-busca.mjs <base.csv> [--revisao base/revisao] [--gravar] [--remover-testes] [--antes <arquivo.sql>]
//
// Sem --gravar é simulação: faz tudo numa transação, confere as restrições do banco e desfaz (ROLLBACK).
// --antes executa um SQL dentro da mesma transação (simular com uma migration ainda não aplicada).
// --remover-testes apaga antes as empresas de demonstração do Busca (seeds 010 e 011) e os usuários delas.
// Ajustes manuais (opcionais) vêm de <revisao>: removidos_categoria.csv (reincluir = sim),
// mantidos_categoria_limitrofe.csv (remover = sim) e redes_propostas.csv (manter_no_grupo = nao; nome_conta).
// Relatório: <revisao>/simulacao.csv (uma linha por linha da base, com a decisão e os campos gravados).
// Conexão: DATABASE_URL_SYSTEM (dono das tabelas; a importação cruza empresas).
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const args = process.argv.slice(2);
const arquivo = args.find((a) => !a.startsWith('--'));
const opt = (nome) => args.includes(nome);
const valor = (nome, padrao) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : padrao; };
if (!arquivo) { console.error('Uso: node scripts/importar-busca.mjs <base.csv> [--revisao <pasta>] [--gravar] [--remover-testes]'); process.exit(1); }
const GRAVAR = opt('--gravar');
const REMOVER_TESTES = opt('--remover-testes');
const REVISAO = valor('--revisao', path.join(path.dirname(arquivo), 'revisao'));
const LOTE = path.basename(arquivo);
const ANTES = valor('--antes', null);

// ── CSV (";", aspas, quebras de linha dentro de campo) ──────────────────────
function lerCsv(texto) {
  const linhas = []; let campo = ''; let linha = []; let aspas = false;
  texto = texto.replace(/^﻿/, '');
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ';') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); campo = ''; if (linha.length > 1 || linha[0] !== '') linhas.push(linha); linha = [];
    } else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cab, ...resto] = linhas;
  return resto.map((l) => Object.fromEntries(cab.map((k, i) => [k.trim(), (l[i] ?? '').trim()])));
}
const csvCampo = (v) => { const s = v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const escreverCsv = (arq, cab, linhas) => fs.writeFileSync(arq, '﻿' + [cab, ...linhas].map((l) => l.map(csvCampo).join(';')).join('\n') + '\n');
const lerRevisao = (nome) => { const arq = path.join(REVISAO, nome); return fs.existsSync(arq) ? lerCsv(fs.readFileSync(arq, 'utf8')) : []; };
const sim = (v) => /^s(im)?$/i.test((v ?? '').trim());
const nao = (v) => /^n(a|ã)?o?$/i.test((v ?? '').trim()) && (v ?? '').trim() !== '';

// ── Regras de seleção ───────────────────────────────────────────────────────
const CATEGORIAS_RAMO = new Set(['Buffet infantil', 'Serviço de catering', 'Buffet de casamento', 'Fornecedor de alimentos e bebidas para catering',
  'Buffet de doces e sobremesas', 'Empresa de catering móvel', 'Local para casamentos', 'Buffet Family', 'Serviço de personal chef',
  'Buffet de festa para crianças', 'Buffet para festas', 'Creperia']);
const CATEGORIAS_LIMITROFES = new Set(['Salão de festas', 'Local para eventos', 'Empresa de organização de eventos', 'Organização de eventos e cerimonial',
  'Serviços para festas infantis', 'Salão de eventos', '', 'Planejador de eventos', 'Restaurante', 'Salão de baile', 'Escritório da empresa', 'Salão',
  'Espaço para eventos', 'Centro de convenções', 'Assessoria e cerimonial de casamentos', 'Serviços para casamento', 'Casa de campo',
  'Área para churrasco', 'Restaurante de churrasquinho', 'Restaurante brasileiro', 'Doceria', 'Fabricação de alimentos']);
const SINAL_BUFFET = /buffet|bufet|catering|gastronom|banquet|coffee|churras|crepe|finger|chef|salgad|domic[ií]lio/i;

// ── Contatos ────────────────────────────────────────────────────────────────
const partes = (v) => (v ?? '').split('|').map((s) => s.trim()).filter(Boolean);
const digitos = (v) => (v ?? '').replace(/\D/g, '');
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const EMAIL_SETOR = /^(compras|rh|franquias?|financeiro|marketing|trabalhe|curriculo|vagas|nfe|fiscal|juridico|no-?reply|privacy|lgpd|dpo|sac)\b/;
const EMAIL_LIXO = /(protected|sentry|wixpress|example\.|exemplo|seudominio|@bit\.ly|locaweb\.com|keepo\.bio|\.(png|jpe?g|gif|webp|svg)$)/;
function email(x) {
  const lista = partes(x.email_valido).map((e) => e.toLowerCase()).filter((e) => EMAIL.test(e) && !EMAIL_LIXO.test(e));
  return lista.find((e) => !EMAIL_SETOR.test(e)) ?? null;
}
const ehCelular = (d) => d.length === 11 && d[2] === '9';
const telValido = (d) => (d.length === 10 || d.length === 11) && !d.startsWith('0') && Number(d.slice(0, 2)) >= 11;
function telefone(x) {
  const lista = partes(x.telefone_valido).map(digitos).filter(telValido);
  return lista.find((d) => d.startsWith('11')) ?? lista[0] ?? null;
}
function whatsapp(x) {
  const lista = partes(x.whatsapp_valido).map(digitos).filter((d) => telValido(d) && ehCelular(d));
  return lista.find((d) => d.startsWith('11')) ?? lista[0] ?? null;
}
const INSTAGRAM_RESERVADO = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'tv', 'instagram']);
function instagram(x) {
  const m = /^@([A-Za-z0-9._]{1,30})$/.exec(x.instagram_usuario ?? '');
  return m && !INSTAGRAM_RESERVADO.has(m[1].toLowerCase()) ? `@${m[1]}` : null;
}
const SITE_NAO_PROPRIO = /(instagram\.com|facebook\.com|linktr\.ee|wa\.me|wa\.link|whatsapp\.com|bit\.ly|beacons\.ai|ifood\.com|contate\.me|lojalocal\.com|instadelivery|whatsmenu|casamentos\.com\.br|gofind|walink|google\.com|goo\.gl)/i;
const SITE_MORTO = /^(reconnect your domain|domínio não encontrado|not found|gerar link para whatsapp|walink)$/i;
function site(x) {
  const s = (x.site ?? '').trim();
  if (!/^https?:\/\/[^/]+\.[a-z]{2,}/i.test(s) || SITE_NAO_PROPRIO.test(s)) return null;
  if (x.status_site.startsWith('erro') || SITE_MORTO.test(x.nome_site ?? '')) return null;
  const u = new URL(s);
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|igsh)/.test(k)) u.searchParams.delete(k);
  return u.toString().slice(0, 255);
}
function cnpjValido(c) {
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (base, pesos) => { const s = base.split('').reduce((t, n, i) => t + Number(n) * pesos[i], 0) % 11; return s < 2 ? 0 : 11 - s; };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return dv(c.slice(0, 12), p1) === Number(c[12]) && dv(c.slice(0, 13), [6, ...p1]) === Number(c[13]);
}
const documento = (x) => { const d = digitos(x.cnpj); return cnpjValido(d) ? d : null; };

// ── Caracterização ──────────────────────────────────────────────────────────
const tokens = (v) => (v ?? '').split(/\s*[,|]\s*/).map((s) => s.trim().toLowerCase()).filter(Boolean);
// Tipos de evento declarados na coleta (coluna tipos_evento) → catálogo do Busca (lib/busca/catalogos.ts)
const EVENTO_DA_BASE = { infantil: 'infantil', casamento: 'casamento', '15 anos': 'debutante', 'aniversario adulto': 'aniversario', corporativo: 'corporativo',
  formatura: 'formatura', bodas: 'bodas', religioso: 'religioso', churrasco: 'churrasco', 'coffee break': 'coffee_break', outros: 'outros' };
const EVENTO_DA_CATEGORIA = { 'Buffet infantil': 'infantil', 'Serviços para festas infantis': 'infantil', 'Buffet de festa para crianças': 'infantil',
  'Buffet de casamento': 'casamento', 'Local para casamentos': 'casamento', 'Assessoria e cerimonial de casamentos': 'casamento', 'Serviços para casamento': 'casamento' };
const ORDEM_EVENTOS = ['casamento', 'bodas', 'aniversario', 'infantil', 'debutante', 'formatura', 'batizado', 'religioso', 'cha', 'churrasco', 'confraternizacao', 'corporativo', 'coffee_break', 'lancamento', 'outros'];
function tiposEvento(x) {
  const t = new Set();
  for (const k of tokens(x.tipos_evento)) if (EVENTO_DA_BASE[k]) t.add(EVENTO_DA_BASE[k]);
  if (EVENTO_DA_CATEGORIA[x.categoria_google]) t.add(EVENTO_DA_CATEGORIA[x.categoria_google]);
  return ORDEM_EVENTOS.filter((s) => t.has(s));
}
// Serviços: termos da coleta, categoria do Google e só o que for evidente no nome. "Buffet" e "catering" são genéricos
// (todo o público do Busca é buffet ou catering) e não diferenciam: não são atribuídos pela base, o buffet marca se quiser.
const SERVICO_DO_TERMO = { 'buffet de casamento': 'buffet_casamento', 'buffet em domicílio': 'buffet_domicilio',
  'buffet infantil': 'buffet_infantil', 'espaço para eventos': 'espaco_eventos', 'salão de festas': 'salao_festas' };
const SERVICO_DA_CATEGORIA = { 'Buffet infantil': 'buffet_infantil', 'Buffet de casamento': 'buffet_casamento', 'Salão de festas': 'salao_festas',
  'Local para eventos': 'espaco_eventos', 'Salão de eventos': 'espaco_eventos', 'Espaço para eventos': 'espaco_eventos', 'Buffet de doces e sobremesas': 'doces_bolo',
  Doceria: 'doces_bolo', 'Área para churrasco': 'churrasco', 'Restaurante de churrasquinho': 'churrasco' };
const ORDEM_SERVICOS = ['buffet_completo', 'buffet_casamento', 'buffet_infantil', 'buffet_domicilio', 'catering', 'espaco_eventos', 'salao_festas', 'finger_food',
  'coquetel', 'empratado', 'churrasco', 'food_truck', 'coffee_break', 'doces_bolo', 'bar_bebidas', 'kids'];
function tiposServico(x) {
  const t = new Set();
  for (const k of tokens(x.termos_busca)) if (SERVICO_DO_TERMO[k]) t.add(SERVICO_DO_TERMO[k]);
  if (SERVICO_DA_CATEGORIA[x.categoria_google]) t.add(SERVICO_DA_CATEGORIA[x.categoria_google]);
  const ev = tokens(x.tipos_evento);
  if (ev.includes('churrasco') || /churras/i.test(x.nome)) t.add('churrasco');
  if (ev.includes('coffee break') || /coffee/i.test(x.nome)) t.add('coffee_break');
  if (/\bfood ?truck/i.test(x.nome)) t.add('food_truck');
  if (/finger ?food/i.test(x.nome)) t.add('finger_food');
  if (/coquetel/i.test(x.nome)) t.add('coquetel');
  if (/empratado/i.test(x.nome)) t.add('empratado');
  if (/\b(doces|bolos?|brigadeiros?|confeitaria)\b/i.test(x.nome)) t.add('doces_bolo');
  if (/\b(drinks?|bartenders?|chopp?)\b/i.test(x.nome)) t.add('bar_bebidas');
  return ORDEM_SERVICOS.filter((s) => t.has(s));
}
const CATEGORIA_ESPACO = new Set(['Salão de festas', 'Local para eventos', 'Salão de eventos', 'Salão de baile', 'Local para casamentos', 'Espaço para eventos',
  'Centro de convenções', 'Casa de campo', 'Buffet infantil', 'Buffet de casamento']);
const CATEGORIA_CATERING = new Set(['Serviço de catering', 'Fornecedor de alimentos e bebidas para catering', 'Empresa de catering móvel']);
const DOMICILIO = /domic[ií]lio/i;
function espacoProprio(x) {
  if (x.espaco_proprio === 'sim') return true;
  if (x.espaco_proprio === 'não') return false;
  return CATEGORIA_ESPACO.has(x.categoria_google) && !DOMICILIO.test(x.nome);
}
function atendeDomicilio(x) {
  if (x.atende_domicilio === 'sim') return true;
  if (x.atende_domicilio === 'não') return false;
  return DOMICILIO.test(x.nome) || CATEGORIA_CATERING.has(x.categoria_google);
}
const RAIO_PADRAO_KM = 25;

function endereco(x) {
  let e = (x.endereco_maps ?? '').replace(//g, '').trim();
  if (e.length < 4) return { logradouro: null, numero: null };
  let m = /^(.*?),\s*(\d[\dA-Za-z./-]{0,15})(?:\s*[-,].*)?$/.exec(e);
  if (m) return { logradouro: m[1].trim().slice(0, 255), numero: m[2] };
  m = /^(\d{1,6})\s+(.+)$/.exec(e);
  if (m) return { logradouro: m[2].trim().slice(0, 255), numero: m[1] };
  return { logradouro: e.slice(0, 255), numero: null };
}
const cepOk = (c) => (/^\d{5}-\d{3}$/.test(c) ? c : null);
const cepNaCapital = (c) => c && ((c >= '01000' && c < '06000') || (c >= '08000' && c < '08500'));
const inteiro = (v) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n >= 1 ? n : null; };

// Descrição neutra: só fatos da base, sem adjetivos
const PLURAL = { casamento: 'casamentos', bodas: 'bodas', aniversario: 'aniversários', infantil: 'festas infantis', debutante: 'festas de 15 anos', formatura: 'formaturas',
  batizado: 'batizados', religioso: 'eventos religiosos', churrasco: 'churrascos', corporativo: 'eventos corporativos', coffee_break: 'coffee breaks' };
const SERVICO_TEXTO = { buffet_casamento: 'buffet de casamento', buffet_infantil: 'buffet infantil', buffet_domicilio: 'buffet em domicílio',
  finger_food: 'finger food', coquetel: 'coquetel volante', empratado: 'serviço empratado', churrasco: 'churrasco', food_truck: 'food truck',
  coffee_break: 'coffee break', doces_bolo: 'doces e bolo', bar_bebidas: 'bar e bebidas' };
const lista = (itens) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`);
function descricao(p) {
  const frases = [];
  const onde = p.bairro ? `no bairro ${p.bairro}, em São Paulo (SP)` : 'em São Paulo (SP)';
  frases.push(`${p.nome} fica ${onde}.`);
  const ev = p.tipos_evento.map((s) => PLURAL[s]).filter(Boolean);
  if (ev.length) frases.push(`Atende ${lista(ev)}.`);
  const sv = p.tipos_servico.map((s) => SERVICO_TEXTO[s]).filter(Boolean);
  if (sv.length) frases.push(`Serviços: ${lista(sv)}.`);
  if (p.espaco_proprio && p.atende_domicilio) frases.push('Tem espaço próprio para eventos e também atende em domicílio.');
  else if (p.espaco_proprio) frases.push('Tem espaço próprio para eventos.');
  else if (p.atende_domicilio) frases.push('Atende em domicílio.');
  if (p.capacidade_min && p.capacidade_max) frases.push(`Recebe de ${p.capacidade_min} a ${p.capacidade_max} convidados.`);
  else if (p.capacidade_max) frases.push(`Recebe até ${p.capacidade_max} convidados.`);
  else if (p.capacidade_min) frases.push(`Atende a partir de ${p.capacidade_min} convidados.`);
  return frases.join(' ').slice(0, 1200);
}

// Completude: mesma conta de lib/busca/onboarding.ts (completude)
function completude(p) {
  const d = (p.descricao ?? '').trim().length;
  const e2 = p.tipos_evento.length > 0 && p.tipos_servico.length > 0;
  const e3 = p.cidade_id != null && ((p.espaco_proprio && p.logradouro) || (p.atende_domicilio && (p.raio_km ?? 0) > 0));
  const e4 = p.capacidade_min != null && p.capacidade_max != null && p.capacidade_min <= p.capacidade_max;
  let pts = d >= 300 ? 15 : d >= 80 ? 8 : 0;
  pts += (e2 ? 10 : 0) + (e3 ? 10 : 0) + (e4 ? 10 : 0);
  pts += (p.email_contato ? 5 : 0) + (p.whatsapp ? 5 : 0) + (p.instagram || p.site ? 5 : 0);
  return Math.min(100, pts);
}

const slugTexto = (v, max = 60) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '') || 'buffet';

// ── Processamento ───────────────────────────────────────────────────────────
const base = lerCsv(fs.readFileSync(arquivo, 'utf8'));
const reincluir = new Set(lerRevisao('removidos_categoria.csv').filter((r) => sim(r['reincluir (sim)'])).map((r) => r.place_id));
const remover = new Set(lerRevisao('mantidos_categoria_limitrofe.csv').filter((r) => sim(r['remover (sim)'])).map((r) => r.place_id));
const redesRev = lerRevisao('redes_propostas.csv');
const foraDoGrupo = new Set(redesRev.filter((r) => nao(r['manter_no_grupo (sim/nao)'])).map((r) => r.place_id));
const nomeContaRev = new Map(redesRev.filter((r) => (r.nome_conta ?? '').trim()).map((r) => [r.place_id, r.nome_conta.trim()]));

const relatorio = [];
const aceitos = [];
for (const x of base) {
  const motivo = (() => {
    if (x.relevante !== 'sim') return 'relevante = não';
    if (x.e_buffet_ia === 'não') return 'IA: não é buffet';
    const cat = x.categoria_google;
    const doRamo = CATEGORIAS_RAMO.has(cat) || (CATEGORIAS_LIMITROFES.has(cat) && (x.e_buffet_ia === 'sim' || SINAL_BUFFET.test(`${x.nome} ${x.nome_site}`)));
    if (remover.has(x.place_id)) return 'removido na revisão';
    if (!doRamo && !reincluir.has(x.place_id)) return CATEGORIAS_LIMITROFES.has(cat) ? 'categoria limítrofe sem sinal de buffet' : 'categoria fora do ramo';
    if (!x.nome.trim()) return 'sem nome';
    return null;
  })();
  if (motivo) { relatorio.push({ x, decisao: 'fora', motivo }); continue; }
  const end = endereco(x);
  const cep = cepOk(x.cep);
  const p = {
    nome: x.nome.replace(/\s+/g, ' ').trim().slice(0, 120), documento: documento(x),
    telefone: telefone(x), whatsapp: whatsapp(x), email_contato: email(x), instagram: instagram(x), site: site(x),
    tipos_evento: tiposEvento(x), tipos_servico: tiposServico(x),
    espaco_proprio: espacoProprio(x), atende_domicilio: atendeDomicilio(x),
    cep, logradouro: end.logradouro, numero: end.numero, bairro: (x.bairro || '').slice(0, 120) || null,
    lat: Number(x.lat), lng: Number(x.lng),
    capacidade_min: inteiro(x.capacidade_min), capacidade_max: inteiro(x.capacidade_max) ?? inteiro(x.capacidade_texto_site),
  };
  p.raio_km = p.atende_domicilio ? RAIO_PADRAO_KM : null;
  if (p.capacidade_min && p.capacidade_max && p.capacidade_min > p.capacidade_max) [p.capacidade_min, p.capacidade_max] = [p.capacidade_max, p.capacidade_min];
  if (!p.telefone && !p.whatsapp && !p.email_contato) { relatorio.push({ x, decisao: 'fora', motivo: 'sem contato válido' }); continue; }
  const avisos = [];
  if (cep && !cepNaCapital(cep)) avisos.push('CEP de outro município');
  if (!end.logradouro) avisos.push('sem endereço');
  else if (!end.numero) avisos.push('endereço sem número');
  if (!p.tipos_evento.length) avisos.push('sem tipo de evento');
  if (p.capacidade_max && p.capacidade_max >= 1000) avisos.push('capacidade muito alta');
  const r = { x, decisao: 'entra', motivo: '', avisos, p };
  relatorio.push(r);
  aceitos.push(r);
}

// Redes: mesma empresa quando compartilham e-mail, Instagram, CNPJ ou o domínio do site próprio (telefone não:
// juntava marcas diferentes). Unidades marcadas "nao" na revisão ficam sozinhas.
const pai = aceitos.map((_, i) => i);
const raiz = (i) => { while (pai[i] !== i) { pai[i] = pai[pai[i]]; i = pai[i]; } return i; };
const chaves = new Map();
aceitos.forEach((r, i) => {
  if (foraDoGrupo.has(r.x.place_id)) return;
  const ks = [...partes(r.x.email_valido).map((e) => `e:${e.toLowerCase()}`), r.p.instagram && `i:${r.p.instagram.toLowerCase()}`, r.p.documento && `c:${r.p.documento}`,
    r.p.site && `s:${new URL(r.p.site).hostname.replace(/^www\./, '')}`].filter(Boolean);
  for (const k of ks) { if (chaves.has(k)) pai[raiz(i)] = raiz(chaves.get(k)); else chaves.set(k, i); }
});
const grupos = new Map();
aceitos.forEach((r, i) => { const g = raiz(i); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(r); });

// Nome da conta da rede: o informado na revisão; senão o prefixo comum dos nomes das unidades; senão o menor nome
function nomeDaConta(unidades) {
  const dado = unidades.map((u) => nomeContaRev.get(u.x.place_id)).find(Boolean);
  if (dado) return dado;
  if (unidades.length === 1) return unidades[0].p.nome;
  const palavras = unidades.map((u) => u.p.nome.split(/\s+/));
  const comum = [];
  for (let i = 0; palavras.every((w) => w[i] && w[i].toLowerCase() === palavras[0][i].toLowerCase()); i++) comum.push(palavras[0][i]);
  while (comum.length && /^(de|da|do|das|dos|e|&|-|–|\||·|unidade)$/i.test(comum.at(-1))) comum.pop();
  const prefixo = comum.join(' ').replace(/[\s\-–|·:,]+$/, '');
  const significativas = comum.filter((w) => !/^(buffet|espaço|espaco|casa|de|da|do|e|&|infantil|kids|eventos|festas|gastronomia|-|–|\||·)$/i.test(w));
  if (significativas.length >= 1 && comum.length >= 2) return prefixo;
  return [...unidades].sort((a, b) => a.p.nome.length - b.p.nome.length)[0].p.nome;
}

// ── Banco ───────────────────────────────────────────────────────────────────
const TESTES = ['buffet-gratuito', 'buffet-sabor-de-festa', 'casa-jardim-eventos', 'mesa-posta-catering', 'villa-toscana-recepcoes', 'brasa-e-cia-churrasco',
  'doce-encanto-festas', 'food-truck-ponto-certo', 'atelie-gastronomico-vila-mariana', 'recanto-das-flores-buffet', 'sabores-do-abc'];

if (!process.env.DATABASE_URL_SYSTEM) { console.error('Defina DATABASE_URL_SYSTEM.'); process.exit(1); }
const db = new pg.Client({ connectionString: process.env.DATABASE_URL_SYSTEM });
await db.connect();
const totais = { empresas: 0, perfis: 0, espacos: 0, testesRemovidos: 0, usuariosRemovidos: 0, jaImportados: 0 };
try {
  await db.query('BEGIN');
  if (ANTES) await db.query(fs.readFileSync(ANTES, 'utf8'));
  if (REMOVER_TESTES) {
    const { rows: us } = await db.query(
      `SELECT DISTINCT tu.usuario_id FROM tenant_usuarios tu JOIN tenants t ON t.id = tu.tenant_id WHERE t.slug = ANY($1)`, [TESTES]);
    const del = await db.query('DELETE FROM tenants WHERE slug = ANY($1)', [TESTES]);
    totais.testesRemovidos = del.rowCount;
    const du = await db.query(
      `DELETE FROM usuarios u WHERE u.id = ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM tenant_usuarios tu WHERE tu.usuario_id = u.id)`,
      [us.map((u) => u.usuario_id)]);
    totais.usuariosRemovidos = du.rowCount;
  }
  const { rows: [plano] } = await db.query(`SELECT id FROM planos WHERE slug = 'busca'`);
  const { rows: [cidade] } = await db.query(`SELECT id FROM busca_cidades WHERE ibge = 3550308`);
  const { rows: ja } = await db.query('SELECT place_id FROM busca_importacao');
  const importados = new Set(ja.map((r) => r.place_id));
  const { rows: slugsT } = await db.query('SELECT slug FROM tenants');
  const usados = new Set(slugsT.map((r) => r.slug));
  const slugLivre = (nome) => { const b = slugTexto(nome, 50); let s = b; for (let n = 2; usados.has(s); n++) s = `${b}-${n}`; usados.add(s); return s; };

  for (const unidades of grupos.values()) {
    const novas = unidades.filter((u) => !importados.has(u.x.place_id));
    unidades.filter((u) => importados.has(u.x.place_id)).forEach((u) => { u.decisao = 'já importado'; totais.jaImportados++; });
    if (!novas.length) continue;
    const nomeConta = nomeDaConta(unidades).slice(0, 120);
    const contato = novas.find((u) => u.p.email_contato) ?? novas[0];
    const { rows: [t] } = await db.query(
      `INSERT INTO tenants (nome, slug, tipo_pessoa, email, telefone, onboarding_completo, origem_cadastro, plano_id)
       VALUES ($1, $2, 'PJ', $3, $4, false, 'importacao', $5) RETURNING id`,
      [nomeConta, slugLivre(nomeConta), contato.p.email_contato, contato.p.whatsapp ?? contato.p.telefone, plano.id]);
    await db.query(
      `INSERT INTO tenant_plano_historico (tenant_id, para_plano_id, motivo, origem, dados) VALUES ($1, $2, 'cadastro', 'migracao', $3)`,
      [t.id, plano.id, JSON.stringify({ importacao: LOTE })]);
    totais.empresas++;
    const nomesEspaco = new Set();
    for (const [ordem, u] of novas.entries()) {
      const p = u.p;
      p.cidade_id = cidade.id;
      p.descricao = descricao(p);
      let espacoId = null;
      if (p.espaco_proprio) {
        let nomeEsp = p.nome;
        if (nomesEspaco.has(nomeEsp.toLowerCase())) nomeEsp = `${p.nome} – ${p.bairro ?? ordem + 1}`.slice(0, 120);
        nomesEspaco.add(nomeEsp.toLowerCase());
        const end = [p.logradouro && [p.logradouro, p.numero].filter(Boolean).join(', '), p.bairro, p.cep].filter(Boolean).join(' – ');
        const { rows: [e] } = await db.query(
          `INSERT INTO espacos (tenant_id, nome, tipo, endereco, cidade, capacidade_min, capacidade_max, contato_telefone, contato_email, ordem)
           VALUES ($1, $2, 'proprio', $3, 'São Paulo', $4, $5, $6, $7, $8) RETURNING id`,
          [t.id, nomeEsp, end || null, p.capacidade_min, p.capacidade_max, p.whatsapp ?? p.telefone, p.email_contato, ordem]);
        espacoId = e.id;
        totais.espacos++;
      }
      const id = randomUUID();
      p.completude = completude(p);
      await db.query(
        `INSERT INTO busca_perfis (id, tenant_id, espaco_id, slug, nome, documento, descricao, telefone, whatsapp, email_contato, instagram, site,
                                   tipos_evento, tipos_servico, atende_domicilio, raio_km, espaco_proprio, cep, logradouro, numero, bairro,
                                   cidade_id, lat, lng, capacidade_min, capacidade_max, etapa_concluida, publicado, publicado_em, completude, nivel)
         VALUES ($1, $2, $3, $27, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
                 6, true, now(), $26, 'gratuito')`,
        [id, t.id, espacoId, p.nome, p.documento, p.descricao, p.telefone, p.whatsapp, p.email_contato, p.instagram, p.site,
         p.tipos_evento, p.tipos_servico, p.atende_domicilio, p.raio_km, p.espaco_proprio, p.cep, p.logradouro, p.numero, p.bairro,
         p.cidade_id, p.lat, p.lng, p.capacidade_min, p.capacidade_max, p.completude, id]);
      const { nota_google, avaliacoes_google, ...dados } = u.x;
      await db.query(`INSERT INTO busca_importacao (tenant_id, perfil_id, place_id, lote, dados) VALUES ($1, $2, $3, $4, $5)`,
        [t.id, id, u.x.place_id, LOTE, JSON.stringify(dados)]);
      u.empresa = nomeConta; u.unidades = unidades.length; u.perfilId = id;
      totais.perfis++;
    }
  }
  // Tempo da consulta de candidatos da vitrine (server/busca/publico.ts) com a base importada
  const t0 = Date.now();
  const { rows: [m] } = await db.query(
    `SELECT count(*) AS n, count(*) FILTER (WHERE fn_tenant_pode(p.tenant_id, 'busca_prioridade') OR fn_tenant_pode(p.tenant_id, 'busca_selo')
                                             OR fn_tenant_pode(p.tenant_id, 'busca_disponibilidade')) AS pagos
       FROM busca_perfis p JOIN tenants t ON t.id = p.tenant_id WHERE p.publicado AND t.status = 'active'`);
  totais.publicadosNaVitrine = Number(m.n);
  totais.msConsultaPlanos = Date.now() - t0;
  const t1 = Date.now();
  await db.query(`SELECT count(*) FILTER (WHERE p.nivel = 'cliente' AND fn_tenant_pode(p.tenant_id, 'busca_selo')) FROM busca_perfis p WHERE p.publicado`);
  totais.msConsultaPlanosSoClientes = Date.now() - t1;
  await db.query(GRAVAR ? 'COMMIT' : 'ROLLBACK');
} catch (e) {
  await db.query('ROLLBACK');
  console.error('Erro — nada foi gravado:', e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}

// ── Relatório ───────────────────────────────────────────────────────────────
fs.mkdirSync(REVISAO, { recursive: true });
escreverCsv(path.join(REVISAO, 'simulacao.csv'),
  ['place_id', 'nome', 'decisao', 'motivo', 'avisos', 'empresa', 'unidades_da_empresa', 'telefone', 'whatsapp', 'email', 'instagram', 'site', 'cnpj',
   'tipos_evento', 'tipos_servico', 'espaco_proprio', 'atende_domicilio', 'logradouro', 'numero', 'bairro', 'cep', 'capacidade_min', 'capacidade_max', 'completude', 'descricao'],
  relatorio.map((r) => [r.x.place_id, r.x.nome, r.decisao, r.motivo, r.avisos?.join(', '), r.empresa, r.unidades, r.p?.telefone, r.p?.whatsapp, r.p?.email_contato,
    r.p?.instagram, r.p?.site, r.p?.documento, r.p?.tipos_evento, r.p?.tipos_servico, r.p && (r.p.espaco_proprio ? 'sim' : 'não'),
    r.p && (r.p.atende_domicilio ? 'sim' : 'não'), r.p?.logradouro, r.p?.numero, r.p?.bairro, r.p?.cep, r.p?.capacidade_min, r.p?.capacidade_max, r.p?.completude, r.p?.descricao]));

const conta = (f) => relatorio.filter(f).length;
const motivos = {};
for (const r of relatorio.filter((r) => r.decisao === 'fora')) motivos[r.motivo] = (motivos[r.motivo] ?? 0) + 1;
const avisos = {};
for (const r of aceitos) for (const a of r.avisos) avisos[a] = (avisos[a] ?? 0) + 1;
console.log(`${GRAVAR ? 'GRAVADO' : 'SIMULAÇÃO (nada gravado)'} — ${LOTE}`);
console.log({ linhas: base.length, entram: aceitos.length, fora: conta((r) => r.decisao === 'fora'), ...totais });
console.log('Fora, por motivo:', motivos);
console.log('Avisos nas que entram:', avisos);
console.log('Cobertura:', {
  telefone: aceitos.filter((r) => r.p.telefone).length, whatsapp: aceitos.filter((r) => r.p.whatsapp).length, email: aceitos.filter((r) => r.p.email_contato).length,
  instagram: aceitos.filter((r) => r.p.instagram).length, site: aceitos.filter((r) => r.p.site).length, cnpj: aceitos.filter((r) => r.p.documento).length,
  tipo_evento: aceitos.filter((r) => r.p.tipos_evento.length).length, tipo_servico: aceitos.filter((r) => r.p.tipos_servico.length).length,
  espaco_proprio: aceitos.filter((r) => r.p.espaco_proprio).length, domicilio: aceitos.filter((r) => r.p.atende_domicilio).length,
  nenhum_modo: aceitos.filter((r) => !r.p.espaco_proprio && !r.p.atende_domicilio).length, capacidade: aceitos.filter((r) => r.p.capacidade_max).length,
});
console.log(`Relatório: ${path.join(REVISAO, 'simulacao.csv')}`);

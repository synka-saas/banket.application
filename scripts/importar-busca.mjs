#!/usr/bin/env node
// Importa a base de buffets (CSV com ";" da coleta do Google Maps + sites) para o Banket Busca. Uma empresa (tenant,
// origem 'importacao', plano Busca, sem usuário) por rede; um perfil publicado por unidade; um espaço por unidade com
// espaço próprio. Só entram linhas relevantes, do ramo (buffet/catering) e com nome e ao menos um contato válido.
//
//   node scripts/importar-busca.mjs <base.csv> [--revisao base/revisao] [--gravar] [--remover-testes] [--estrito] [--sem-categoria] [--antes <arquivo.sql>]
//
// Sem --gravar é simulação: faz tudo numa transação, confere as restrições do banco e desfaz (ROLLBACK).
// --antes executa um SQL dentro da mesma transação (simular com uma migration ainda não aplicada).
// --remover-testes apaga antes as empresas de demonstração do Busca (seeds 010 e 011) e os usuários delas.
// Ajustes manuais (opcionais) vêm de <revisao>: removidos_categoria.csv (reincluir = sim),
// mantidos_categoria_limitrofe.csv (remover = sim) e redes_propostas.csv (manter_no_grupo = nao; nome_conta).
// Relatório: <revisao>/simulacao-<arquivo>.csv (uma linha por linha da base, com a decisão e os campos gravados).
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
const ESTRITO = opt('--estrito');
const SEM_CATEGORIA = opt('--sem-categoria'); // a coluna relevante já decidiu o ramo: não filtra pela categoria do Google
const REVISAO = valor('--revisao', path.join(path.dirname(arquivo), 'revisao'));
const LOTE = path.basename(arquivo);
const ANTES = valor('--antes', null);

// ── CSV ("," ou ";", detectado no cabeçalho; aspas e quebras de linha dentro de campo) ──
function lerCsv(texto) {
  const linhas = []; let campo = ''; let linha = []; let aspas = false;
  texto = texto.replace(/^﻿/, '');
  const cab0 = texto.slice(0, Math.max(0, texto.search(/\r?\n/)));
  const sep = cab0.split(';').length >= cab0.split(',').length ? ';' : ',';
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
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
// Regra estrita (--estrito; o Busca é só para buffets): categoria de buffet entra, salvo nome de outro negócio; catering
// precisa de sinal de evento no nome; o resto precisa de "buffet"/"catering" no nome. Buffet por quilo nunca entra.
const CATEGORIAS_BUFFET = new Set(['Buffet infantil', 'Buffet de casamento', 'Buffet para festas', 'Buffet de festa para crianças', 'Buffet Family', 'Serviço de bufê']);
const NOME_BUFFET = /buf+[eê]t?\b|buffet|catering|banquet/i;
const NOME_EVENTO = /buf+[eê]t?\b|buffet|catering|banquet|gastronom|evento|festa|recep[cç]|chef|cuisine|cozinha|coffee|finger|churras/i;
const NOME_OUTRO_NEGOCIO = /\b(bolos?|doces?|docinhos|doceria|confeitaria|salgad\w*|bal[õo]es|brinquedos?|loca[cç](ao|ão|oes|ões)|locadora|aluguel|brinquedoteca|barman|barmen|m[aá]gic[oa]|m[aá]gica|show|palha[cç]\w*|macarons?|brigadeiros?|churros|algod[aã]o doce|divers[aã]o|recrea[cç]\w*|shopping|parque|park|play|boliche|bowling|pizzaria|lanche|lanchonete|petiscaria|bar|pub|drinks?|bartend\w*|open bar|chopp?|decora[cç]\w*|cerimonial|assessoria|fotografia|convites?|lembrancinhas|personalizados|kit festas?|mercearia|atacad\w*|distribuidora|empresa nao existe)\b/i;
const NOME_NAO_EVENTO = /(por (kg|quilo)|\bkg\b|marmit|self[- ]?service|refei[cç](ao|ão|oes|ões) coletiva|alimenta[cç](ao|ão) (empresarial|coletiva)|nutricional|sodexo|china buffet|restaurante buffet)/i;
function doRamoEstrito(x) {
  const nome = x.nome;
  if (NOME_NAO_EVENTO.test(nome)) return false;
  const cat = x.categoria_google;
  if (CATEGORIAS_BUFFET.has(cat)) return NOME_BUFFET.test(nome) || !NOME_OUTRO_NEGOCIO.test(nome);
  if (cat === 'Serviço de catering') return NOME_EVENTO.test(nome) && (NOME_BUFFET.test(nome) || !NOME_OUTRO_NEGOCIO.test(nome));
  const evento = /evento|festa|recep[cç]|catering|domic|casamento|anivers/i;
  if (cat === 'Serviço de locação de artigos de festa') return NOME_BUFFET.test(nome) && !/aluguel|loca[cç]|utens|materia|pegue|monte/i.test(nome);
  // Categoria do ramo de eventos: basta "buffet" no nome. Outras (restaurante, padaria, marcenaria — "buffet" também é
  // móvel —, estacionamento…): "buffet" e uma palavra de evento no nome.
  if (CATEGORIAS_RAMO.has(cat) || (CATEGORIAS_LIMITROFES.has(cat) && !/^(Restaurante|Doceria|Fabrica)/.test(cat))) return NOME_BUFFET.test(nome);
  return NOME_BUFFET.test(nome) && evento.test(nome);
}

// ── Contatos ────────────────────────────────────────────────────────────────
const partes = (v) => (v ?? '').split(/[|,;]/).map((s) => s.trim()).filter(Boolean);
const digitos = (v) => (v ?? '').replace(/\D/g, '');
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const EMAIL_SETOR = /^(compras|rh|franquias?|financeiro|marketing|trabalhe|curriculo|vagas|nfe|fiscal|juridico|no-?reply|privacy|lgpd|dpo|sac)\b/;
const EMAIL_LIXO = /(protected|sentry|wixpress|example\.|exemplo|seudominio|@bit\.ly|locaweb\.com|keepo\.bio|@wa\.link|instabio|\.gov(\.br)?$|\.(png|jpe?g|gif|webp|svg)$)/;
// Palavras que identificam um buffet (sem acento, 4+ letras, sem as genéricas do ramo e dos e-mails)
const semAcento = (v) => (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const GENERICAS = new Set(['buffet', 'buffets', 'bufe', 'festa', 'festas', 'evento', 'eventos', 'espaco', 'casa', 'salao', 'chacara', 'sitio',
  'recanto', 'gastronomia', 'catering', 'kids', 'infantil', 'park', 'contato', 'comercial', 'orcamento', 'orcamentos', 'atendimento',
  'vendas', 'gmail', 'hotmail', 'yahoo', 'outlook', 'oficial', 'unidade', 'grupo', 'ltda', 'servicos', 'decoracoes', 'decoracao', 'locacao']);
const palavras = (v) => new Set(semAcento(v).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !GENERICAS.has(w)));
const nomesCombinam = (nomes) => {
  const [a, ...resto] = nomes.map(palavras);
  return [...(a ?? [])].some((w) => resto.every((p) => p.has(w)));
};
// Chave (e-mail, Instagram, site) usada por várias linhas cujos nomes não têm nada em comum: dado de coleta trocado
const ambiguas = new Set();
const contagemEmail = new Map();
// e-mail do formato novo (origem_email): do site/Instagram do buffet vale; da busca web só se for exclusivo da linha e
// combinar com o nome (a busca web colou o mesmo e-mail em buffets de nome parecido). Formato antigo: como veio.
function emailConfiavel(e, x) {
  if (ambiguas.has(`e:${e}`)) return false;
  if (x.origem_email === undefined) return true;
  if (x.email_dominio_ok === 'não') return false;
  if (x.origem_email === 'site' || x.origem_email === 'instagram') return true;
  return contagemEmail.get(e) === 1 && [...palavras(x.nome)].some((w) => semAcento(e).includes(w));
}
const emails = (x) => partes(x.email_valido).map((e) => e.toLowerCase()).filter((e) => EMAIL.test(e) && !EMAIL_LIXO.test(e) && emailConfiavel(e, x));
function email(x) {
  return emails(x).find((e) => !EMAIL_SETOR.test(e)) ?? null;
}
const ehCelular = (d) => d.length === 11 && d[2] === '9';
const telValido = (d) => (d.length === 10 || d.length === 11) && !d.startsWith('0') && Number(d.slice(0, 2)) >= 11;
// DDD da cidade: o informado ou o mais comum nas linhas da mesma cidade (base com várias capitais); São Paulo por padrão
const dddPorCidade = new Map();
const ddd = (x) => dddPorCidade.get(String(x.codigo_ibge)) ?? '11';
function telefone(x) {
  const lista = partes(x.telefone_valido).map(digitos).filter(telValido);
  return lista.find((d) => d.startsWith(ddd(x))) ?? lista[0] ?? null;
}
function whatsapp(x) {
  const lista = partes(x.whatsapp_valido).map(digitos).filter((d) => telValido(d) && ehCelular(d));
  return lista.find((d) => d.startsWith(ddd(x))) ?? lista[0] ?? null;
}
const INSTAGRAM_RESERVADO = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'tv', 'instagram', 'whatsapp', 'wa.link', 'instaumbler',
  'goomer_br', 'invites', 'linklist', 'linktree', 'linktr.ee', 'umbler', 'meta', 'facebook']);
function instagram(x) {
  const m = /^@([A-Za-z0-9._]{1,30})$/.exec(x.instagram_usuario ?? '');
  if (!m || INSTAGRAM_RESERVADO.has(m[1].toLowerCase()) || /\.(php|html?)$/i.test(m[1])) return null;
  return ambiguas.has(`i:@${m[1].toLowerCase()}`) ? null : `@${m[1]}`;
}
const SITE_NAO_PROPRIO = /(instagram\.com|facebook\.com|linktr\.ee|wa\.me|wa\.link|whatsapp\.com|bit\.ly|beacons\.ai|ifood\.com|contate\.me|lojalocal\.com|instadelivery|whatsmenu|casamentos\.com\.br|gofind|walink|google\.com|goo\.gl|anota\.ai|goomer|cardapioweb|linkfacil|mechamenozap|linkbio|linklist|umbler|wixsite\.com\/?$)/i;
const SITE_MORTO = /^(reconnect your domain|domínio não encontrado|not found|gerar link para whatsapp|walink)$/i;
function site(x) {
  const s = (x.site ?? '').trim();
  if (!/^https?:\/\/[^/]+\.[a-z]{2,}/i.test(s) || SITE_NAO_PROPRIO.test(s)) return null;
  if ((x.status_site ?? '').startsWith('erro') || SITE_MORTO.test(x.nome_site ?? '')) return null;
  const u = new URL(s);
  if (ambiguas.has(`s:${u.hostname.replace(/^www\./, '')}`)) return null;
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|igsh)/.test(k)) u.searchParams.delete(k);
  return u.toString().slice(0, 255);
}
function cnpjValido(c) {
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (base, pesos) => { const s = base.split('').reduce((t, n, i) => t + Number(n) * pesos[i], 0) % 11; return s < 2 ? 0 : 11 - s; };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return dv(c.slice(0, 12), p1) === Number(c[12]) && dv(c.slice(0, 13), [6, ...p1]) === Number(c[13]);
}
// CNPJ usado por linhas de nomes sem relação é o da plataforma de links (Umbler, Bielo Mídia…), não do buffet
const documento = (x) => { const d = digitos(x.cnpj); return cnpjValido(d) && !ambiguas.has(`c:${d}`) ? d : null; };

// ── Caracterização ──────────────────────────────────────────────────────────
const tokens = (v) => (v ?? '').split(/\s*[,|;]\s*/).map((s) => s.trim().toLowerCase()).filter(Boolean);
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
// Formato novo: "R. Danilo Corrêa, 1629, Japiim, Manaus - AM, 69000-000" → "R. Danilo Corrêa, 1629" (sem bairro,
// cidade e CEP); só a cidade ou só o bairro → sem endereço
const RUA = /^(r\.|rua|av\.?|avenida|al\.?|alameda|estr\.?|estrada|rod\.?|rodovia|tv\.?|travessa|p[çc]a\.?|pra[çc]a|largo|lgo\.?|qd|quadra|sq|shis|shin|clsw|cln|cls|sgas|q\.|setor|via|ladeira|beco|vila|servid[aã]o|parque|condom[ií]nio)/i;
function ruaDoEndereco(completo, bairro) {
  const partesEnd = (completo ?? '').split(/,\s*/).map((s) => s.trim()).filter(Boolean)
    .filter((s) => !/^\d{5}-?\d{3}$/.test(s) && !/\s-\s[A-Z]{2}$/.test(s) && !/^[A-Z]{2}$/.test(s) && s !== 'Brasil')
    .filter((s) => !bairro || semAcento(s) !== semAcento(bairro));
  if (!partesEnd.length) return '';
  if (!/\d/.test(partesEnd.join(' ')) && !RUA.test(partesEnd[0])) return '';
  return partesEnd.slice(0, /^\d/.test(partesEnd[1] ?? '') ? 2 : 1).join(', ');
}
const cepOk = (c) => (/^\d{5}-\d{3}$/.test(c) ? c : null);
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
  const cidade = `${p.cidade_nome} (${p.cidade_uf})`;
  const onde = p.bairro ? `no bairro ${p.bairro}, em ${cidade}` : `em ${cidade}`;
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
// Dois formatos de coleta: o de 16/10 (";", endereco_maps, lat/lng, e_buffet_ia) e o de 17/10 (",", endereço completo,
// latitude/longitude, origem_email, várias cidades; email/telefone/whatsapp_celular sem o sufixo _valido). Tudo vira os
// nomes do formato antigo.
function normalizar(x) {
  if (x.lat === undefined) x.lat = x.latitude;
  if (x.lng === undefined) x.lng = x.longitude;
  if (x.endereco_maps === undefined) x.endereco_maps = ruaDoEndereco(x.endereco, x.bairro);
  if (x.email_valido === undefined) x.email_valido = x.email;
  if (x.telefone_valido === undefined) x.telefone_valido = x.telefone;
  if (x.whatsapp_valido === undefined) x.whatsapp_valido = x.whatsapp_celular;
  for (const k of ['e_buffet_ia', 'nome_site', 'capacidade_texto_site', 'status_site', 'email_valido', 'telefone_valido', 'whatsapp_valido']) x[k] ??= '';
  return x;
}
const base = lerCsv(fs.readFileSync(arquivo, 'utf8')).map(normalizar);
{
  const porCidade = new Map();
  for (const x of base) {
    if (!porCidade.has(x.codigo_ibge)) porCidade.set(x.codigo_ibge, new Map());
    const c = porCidade.get(x.codigo_ibge);
    for (const d of [...partes(x.telefone_valido), ...partes(x.whatsapp_valido)].map(digitos).filter(telValido)) c.set(d.slice(0, 2), (c.get(d.slice(0, 2)) ?? 0) + 1);
  }
  for (const [ibge, c] of porCidade) if (c.size) dddPorCidade.set(String(ibge), [...c].sort((a, b) => b[1] - a[1])[0][0]);
}
for (const x of base) for (const e of partes(x.email_valido)) contagemEmail.set(e.toLowerCase(), (contagemEmail.get(e.toLowerCase()) ?? 0) + 1);
{
  const porChave = new Map();
  const add = (k, nome) => { if (!porChave.has(k)) porChave.set(k, []); porChave.get(k).push(nome); };
  for (const x of base) {
    for (const e of new Set(partes(x.email_valido).map((e) => e.toLowerCase()))) add(`e:${e}`, x.nome);
    if (x.instagram_usuario) add(`i:${x.instagram_usuario.toLowerCase()}`, x.nome);
    if (digitos(x.cnpj)) add(`c:${digitos(x.cnpj)}`, x.nome);
    try { if (/^https?:\/\//.test(x.site)) add(`s:${new URL(x.site).hostname.replace(/^www\./, '')}`, x.nome); } catch { /* site inválido */ }
  }
  for (const [k, nomes] of porChave) if (nomes.length > 1 && !nomesCombinam(nomes)) ambiguas.add(k);
}

if (!process.env.DATABASE_URL_SYSTEM) { console.error('Defina DATABASE_URL_SYSTEM.'); process.exit(1); }
const db = new pg.Client({ connectionString: process.env.DATABASE_URL_SYSTEM });
await db.connect();
// Cidades (pelo código do IBGE da linha) e o que já existe no Busca: importados, exclusões e contatos de todos os perfis
const cidades = new Map((await db.query('SELECT id, ibge, nome, uf, lat, lng FROM busca_cidades')).rows.map((c) => [String(c.ibge), c]));
const importados = new Set((await db.query('SELECT place_id FROM busca_importacao')).rows.map((r) => r.place_id));
const existentes = await db.query(
  `SELECT nome, lat, lng, lower(email_contato) AS email, whatsapp, telefone, lower(instagram) AS instagram, site FROM busca_perfis`);
const hostDe = (s) => { try { return new URL(s).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };
const contatosExistentes = new Set(existentes.rows.flatMap((r) => [r.email, r.whatsapp, r.telefone, r.instagram, r.site && `s:${hostDe(r.site)}`]).filter(Boolean));
// Mesmo buffet com outro place_id: nome com as mesmas palavras a até 300 m (perfis existentes e linhas já aceitas)
const chaveNome = (nome) => [...palavras(nome)].sort().join(' ');
const locais = new Map();
const guardarLocal = (nome, lat, lng) => { const k = chaveNome(nome); if (!k || !Number.isFinite(lat)) return; if (!locais.has(k)) locais.set(k, []); locais.get(k).push([lat, lng]); };
for (const r of existentes.rows) guardarLocal(r.nome, Number(r.lat), Number(r.lng));
const temExclusoes = (await db.query(`SELECT to_regclass('busca_exclusoes') IS NOT NULL AS existe`)).rows[0].existe;
const exc = temExclusoes ? (await db.query('SELECT place_id, emails, telefones FROM busca_exclusoes')).rows : [];
const excluidos = { places: new Set(exc.map((e) => e.place_id).filter(Boolean)), contatos: new Set(exc.flatMap((e) => [...e.emails, ...e.telefones])) };
const km = (a, b, c, d) => {
  const r = Math.PI / 180;
  return 12742 * Math.asin(Math.sqrt(Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2));
};
const vistos = new Map(); // nome normalizado + contato → já aceito neste arquivo
// Mesmo lugar com duas fichas no Google (nomes diferentes): mesmo WhatsApp/telefone a até 150 m de uma linha já aceita
const porContato = new Map();
const mesmoLugar = (p, contatos) => contatos.some((c) => (porContato.get(c) ?? []).some(([la, ln]) => km(p.lat, p.lng, la, ln) <= 0.15));
const pertoDeMesmoNome = (p) => (locais.get(chaveNome(p.nome)) ?? []).some(([la, ln]) => km(p.lat, p.lng, la, ln) <= 0.3);
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
    const doRamo = ESTRITO ? doRamoEstrito(x)
      : CATEGORIAS_RAMO.has(cat) || (CATEGORIAS_LIMITROFES.has(cat) && (x.e_buffet_ia === 'sim' || SINAL_BUFFET.test(`${x.nome} ${x.nome_site}`)));
    if (remover.has(x.place_id)) return 'removido na revisão';
    if (!SEM_CATEGORIA && !doRamo && !reincluir.has(x.place_id)) return ESTRITO ? 'não é buffet (categoria/nome)' : CATEGORIAS_LIMITROFES.has(cat) ? 'categoria limítrofe sem sinal de buffet' : 'categoria fora do ramo';
    if (!x.nome.trim()) return 'sem nome';
    if (importados.has(x.place_id)) return 'já importado';
    if (excluidos.places.has(x.place_id)) return 'pediu exclusão';
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
    lat: Number(x.lat), lng: Number(x.lng), cidade_id: null, cidade_nome: null, cidade_uf: null,
    capacidade_min: inteiro(x.capacidade_min), capacidade_max: inteiro(x.capacidade_max) ?? inteiro(x.capacidade_texto_site),
  };
  p.raio_km = p.atende_domicilio ? RAIO_PADRAO_KM : null;
  if (p.capacidade_min && p.capacidade_max && p.capacidade_min > p.capacidade_max) [p.capacidade_min, p.capacidade_max] = [p.capacidade_max, p.capacidade_min];
  if (!p.telefone && !p.whatsapp && !p.email_contato && !p.instagram && !p.site) { relatorio.push({ x, decisao: 'fora', motivo: 'sem contato válido' }); continue; }
  const cid = cidades.get(String(x.codigo_ibge ?? '3550308'));
  if (!cid) { relatorio.push({ x, decisao: 'fora', motivo: 'cidade fora do catálogo' }); continue; }
  if (Number.isFinite(p.lat) && km(p.lat, p.lng, cid.lat, cid.lng) > 80) { relatorio.push({ x, decisao: 'fora', motivo: 'coordenadas longe da cidade informada' }); continue; }
  Object.assign(p, { cidade_id: cid.id, cidade_nome: cid.nome, cidade_uf: cid.uf });
  const contatos = [p.email_contato, p.whatsapp, p.telefone].filter(Boolean);
  if (contatos.some((c) => excluidos.contatos.has(c))) { relatorio.push({ x, decisao: 'fora', motivo: 'pediu exclusão' }); continue; }
  const redes = [p.instagram?.toLowerCase(), p.site && `s:${hostDe(p.site)}`].filter(Boolean);
  if ([...contatos, ...redes].some((c) => contatosExistentes.has(c))) { relatorio.push({ x, decisao: 'fora', motivo: 'mesmo contato de um perfil já existente' }); continue; }
  if (pertoDeMesmoNome(p)) { relatorio.push({ x, decisao: 'fora', motivo: 'mesmo nome e local de um perfil já existente ou de outra linha' }); continue; }
  const chaveRepetido = contatos.map((c) => `${[...palavras(p.nome)].sort().join(' ')}|${c}`);
  if (chaveRepetido.some((k) => vistos.has(k))) { relatorio.push({ x, decisao: 'fora', motivo: 'repetido no arquivo (mesmo nome e contato)' }); continue; }
  const fones = [p.whatsapp, p.telefone].filter(Boolean);
  if (Number.isFinite(p.lat) && mesmoLugar(p, fones)) { relatorio.push({ x, decisao: 'fora', motivo: 'repetido no arquivo (mesmo telefone e local)' }); continue; }
  if (Number.isFinite(p.lat)) for (const c of fones) { if (!porContato.has(c)) porContato.set(c, []); porContato.get(c).push([p.lat, p.lng]); }
  chaveRepetido.forEach((k) => vistos.set(k, x.place_id));
  guardarLocal(p.nome, p.lat, p.lng);
  const avisos = [];
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
  const ks = [...emails(r.x).map((e) => `e:${e}`), r.p.instagram && `i:${r.p.instagram.toLowerCase()}`, r.p.documento && `c:${r.p.documento}`,
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

const totais = { empresas: 0, perfis: 0, espacos: 0, testesRemovidos: 0, usuariosRemovidos: 0 };
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
  const { rows: slugsT } = await db.query('SELECT slug FROM tenants');
  const usados = new Set(slugsT.map((r) => r.slug));
  const slugLivre = (nome) => { const b = slugTexto(nome, 50); let s = b; for (let n = 2; usados.has(s); n++) s = `${b}-${n}`; usados.add(s); return s; };

  for (const unidades of grupos.values()) {
    // Já importados, exclusões e contatos repetidos ficaram de fora na seleção (antes de agrupar)
    const novas = unidades;
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
      p.descricao = descricao(p);
      let espacoId = null;
      if (p.espaco_proprio) {
        let nomeEsp = p.nome;
        if (nomesEspaco.has(nomeEsp.toLowerCase())) nomeEsp = `${p.nome} – ${p.bairro ?? ordem + 1}`.slice(0, 120);
        nomesEspaco.add(nomeEsp.toLowerCase());
        const end = [p.logradouro && [p.logradouro, p.numero].filter(Boolean).join(', '), p.bairro, p.cep].filter(Boolean).join(' – ');
        const { rows: [e] } = await db.query(
          `INSERT INTO espacos (tenant_id, nome, tipo, endereco, cidade, capacidade_min, capacidade_max, contato_telefone, contato_email, ordem)
           VALUES ($1, $2, 'proprio', $3, $9, $4, $5, $6, $7, $8) RETURNING id`,
          [t.id, nomeEsp, end || null, p.capacidade_min, p.capacidade_max, p.whatsapp ?? p.telefone, p.email_contato, ordem, p.cidade_nome]);
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
const RELATORIO = path.join(REVISAO, `simulacao-${path.parse(LOTE).name}.csv`);
escreverCsv(RELATORIO,
  ['place_id', 'nome', 'cidade', 'decisao', 'motivo', 'avisos', 'empresa', 'unidades_da_empresa', 'telefone', 'whatsapp', 'email', 'instagram', 'site', 'cnpj',
   'tipos_evento', 'tipos_servico', 'espaco_proprio', 'atende_domicilio', 'logradouro', 'numero', 'bairro', 'cep', 'capacidade_min', 'capacidade_max', 'completude', 'descricao'],
  relatorio.map((r) => [r.x.place_id, r.x.nome, r.x.municipio ?? r.p?.cidade_nome, r.decisao, r.motivo, r.avisos?.join(', '), r.empresa, r.unidades, r.p?.telefone, r.p?.whatsapp, r.p?.email_contato,
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
console.log(`Relatório: ${RELATORIO}`);

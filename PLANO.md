# Banket Busca — Plano de implementação

> Decorre de [ANALISE_BUSCA.md](ANALISE_BUSCA.md) (decisões D1–D9 e suposições A1–A2, 15/10/2026). Modelo: o Busca é
> uma funcionalidade do Banket liberada por plano; o **Plano Busca** é gratuito e libera só o menu "Banket Busca";
> a vitrine pública roda em `busca.banket.com.br` pelo mesmo app. Referência de implementação: o Concierge gratuito
> do Yosp (`/var/www/yosp`, migrations 066–071, `feature-routes.js`, `plan-change.js`).

## 1. Princípios

1. **Toda restrição vive no servidor** (middleware, `server/*`, SQL). A interface só espelha o estado.
2. **Uma única fonte**: `fn_tenant_entitlements(tenant_id)` no banco; o código nunca lê `planos` direto para decidir.
3. **Um único dono das transições de plano**: `server/planos.ts`. Cadastro, HCP, trial, agendador e (futuro) Stripe
   passam por ele e gravam `tenant_plano_historico`.
4. **Rebaixar nunca apaga**: excedentes ficam marcados e fora de uso; upgrade restaura.
5. **Regressão zero nas empresas atuais**: backfill no plano Completo (tudo liberado) e "sem plano = permissivo".
6. **Migrations aditivas** e compatíveis com a cor anterior; `down` documentado em comentário (o runner não aplica).
7. **Números reais** nas mensagens de upsell (contadores do próprio tenant); nada inventado.
8. Convenções do projeto: português, `withTenant`, zod, design system, Tabler, mobile em media queries, testes ao lado.

---

## 2. Schema

### 2.1 Migration `031_planos.sql` — sistema de planos

```sql
CREATE TABLE planos (
  id UUID PK, slug VARCHAR(40) UNIQUE, nome VARCHAR(80), descricao TEXT,
  gratuito BOOLEAN NOT NULL DEFAULT false,      -- nunca entra em trial/cobrança
  publico BOOLEAN NOT NULL DEFAULT true,        -- aparece em /planos e no HCP
  ativo BOOLEAN NOT NULL DEFAULT true, ordem INT NOT NULL DEFAULT 0,
  preco_mensal NUMERIC(10,2), preco_anual NUMERIC(10,2),
  trial_dias INT NOT NULL DEFAULT 30,
  recursos JSONB NOT NULL DEFAULT '{}',         -- {slug: true|false|int}; -1 = sem limite
  stripe_product_id TEXT, stripe_price_mensal_id TEXT, stripe_price_anual_id TEXT,   -- padrão Hwesta, uso futuro
  created_at, updated_at);
-- sem RLS: catálogo global; GRANT SELECT ao papel do app

ALTER TABLE tenants ADD COLUMN
  plano_id UUID REFERENCES planos(id) ON DELETE RESTRICT,
  plano_pendente_id UUID REFERENCES planos(id),         -- futuro Stripe (R3 do Yosp)
  trial_ate DATE, trial_iniciado_em TIMESTAMPTZ, trial_usado_em TIMESTAMPTZ, trial_recusado_em TIMESTAMPTZ,
  plano_rebaixado_em TIMESTAMPTZ,
  origem_cadastro VARCHAR(10) NOT NULL DEFAULT 'site' CHECK (origem_cadastro IN ('site','busca'));

ALTER TABLE tenant_usuarios ADD COLUMN bloqueado_plano_em TIMESTAMPTZ;   -- excedente de usuários

CREATE TABLE tenant_plano_historico (
  id UUID PK, tenant_id UUID NOT NULL REFERENCES tenants ON DELETE CASCADE,
  de_plano_id UUID REFERENCES planos ON DELETE SET NULL, para_plano_id UUID REFERENCES planos ON DELETE SET NULL,
  motivo VARCHAR(30) CHECK IN ('cadastro','migracao','trial_iniciado','trial_encerrado','upgrade','downgrade',
                               'hwesta','backoffice','assinatura','cancelamento'),
  origem VARCHAR(20) CHECK IN ('app','hwesta','agendador','migracao','stripe'),
  usuario_id UUID REFERENCES usuarios ON DELETE SET NULL, dados JSONB NOT NULL DEFAULT '{}', created_at);
SELECT aplicar_rls('tenant_plano_historico');

CREATE TABLE plano_avisos (            -- dedup dos e-mails do trial (duas cores do blue-green)
  tenant_id UUID REFERENCES tenants ON DELETE CASCADE, chave VARCHAR(40), enviado_em TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tenant_id, chave));
SELECT aplicar_rls('plano_avisos');

-- Catálogo inicial (INSERT ... ON CONFLICT (slug) DO UPDATE SET recursos = EXCLUDED.recursos):
--   busca (gratuito, publico=false), essencial 97/970, profissional 197/1970, prime 297/2970, completo (interno)
-- Backfill: UPDATE tenants SET plano_id = (completo) WHERE plano_id IS NULL; uma linha 'migracao' no histórico.
-- fn_tenant_entitlements(uuid) RETURNS jsonb, STABLE SECURITY DEFINER (ver 4.1).
```

`hwesta_entitlements` passa a significar **override** do Manager: `capabilities` sobrepõe `planos.recursos`;
`plan_slug` lá é só espelho do que o Manager enviou por último (a verdade é `tenants.plano_id`).

### 2.2 Migration `032_busca.sql` — marketplace

Todas com `tenant_id` + `aplicar_rls`, exceto `busca_cidades` (global, política `USING (true)` para leitura).

| Tabela | Colunas principais | Relações |
|---|---|---|
| `busca_cidades` | `id`, `ibge INT UNIQUE`, `nome`, `uf CHAR(2)`, `slug UNIQUE` (`campinas-sp`), `lat`, `lng`, `capital BOOL`, índice GiST `ll_to_earth(lat,lng)`, índice trigram em `unaccent(nome)` | dados na `033_busca_cidades.sql` (IBGE + centroides) |
| `busca_perfis` | `tenant_id UNIQUE`, `slug VARCHAR(80) UNIQUE` (global), `nome`, `descricao`, `logo_path`, `telefone`, `whatsapp`, `email_contato`, `instagram`, `site`, `tipos_evento TEXT[]`, `tipos_servico TEXT[]`, `restricoes TEXT[]`, `atende_domicilio BOOL`, `raio_km INT`, `espaco_proprio BOOL`, `cep`, `logradouro`, `numero`, `bairro`, `cidade_id → busca_cidades`, `lat`, `lng`, `capacidade_min INT`, `capacidade_max INT`, `aceita_menor BOOL`, `valor_minimo NUMERIC`, `tempo_resposta_texto`, `etapa_concluida INT` (0–6), `publicado BOOL`, `publicado_em`, `completude INT` (0–100, recalculado ao salvar), `nivel VARCHAR(10) CHECK ('gratuito','cliente')`, `nota_media NUMERIC(3,2)`, `total_avaliacoes INT`, `taxa_resposta NUMERIC(5,2)`, `sincronizar_agenda BOOL`, `excedentes JSONB` (`{tipos_evento:[], tipos_servico:[]}` guardados no rebaixamento) | `tenants` 1–1 |
| `busca_perfil_cidades` | `perfil_id`, `cidade_id`, UNIQUE | cidades atendidas explicitamente (além do raio) |
| `busca_pacotes` | `perfil_id`, `nome`, `descricao`, `preco_pessoa NUMERIC`, `convidados_min`, `convidados_max`, `inclui TEXT[]`, `cardapio_opcao_id → cardapio_opcoes ON DELETE SET NULL` (cliente: cardápio detalhado ao vivo), `ativo`, `ordem` | `cardapio_opcoes` |
| `busca_fotos` | `perfil_id`, `path` (`busca/{uuid}.jpg` em `storage`), `legenda`, `tags TEXT[]`, `ordem`, `capa BOOL`, `bloqueado_plano_em` | — |
| `busca_bloqueios` | `perfil_id`, `data_inicio DATE`, `data_fim DATE`, `motivo` | disponibilidade manual (cliente) |
| `busca_pedidos` | `perfil_id`, `grupo_id UUID` (mesmo pedido a vários buffets), `evento_id → eventos ON DELETE SET NULL`, `cliente_id → clientes SET NULL`, `conversa_id → conversas SET NULL`, `tipo_evento`, `tipo_servico`, `data_evento DATE`, `convidados INT`, `cidade_id`, `local_texto`, `nome`, `email`, `whatsapp`, `observacoes`, `aceite_contato BOOL`, `respondido_em`, `filtros JSONB` (snapshot da busca), `ip`, `created_at` | `eventos`, `clientes`, `conversas` |
| `busca_avaliacoes` | `pedido_id UNIQUE`, `perfil_id`, `token_hash CHAR(64) UNIQUE`, `token_expira_em`, `nota SMALLINT 1–5`, `texto`, `nome_exibicao`, `respondida_em`, `resposta_buffet`, `resposta_em`, `publicada BOOL`, `ip` | `busca_pedidos` |
| `busca_metricas_dia` | `perfil_id`, `dia DATE`, `aparicoes INT`, `visualizacoes INT`, `cliques_orcamento INT`, UNIQUE (`perfil_id`,`dia`) | upsert pela vitrine |
| `busca_upsell_eventos` (**criada na 031**, fase 1) | `usuario_id`, `tipo CHECK ('cadeado_visto','cta_clicado','planos_visitado','trial_iniciado','trial_recusado','assinatura_concluida','rebaixado')`, `recurso`, `dados JSONB`, `created_at` | relatório HCP (A2) |

Mais: `ALTER TABLE eventos DROP CONSTRAINT …origem_check; ADD CHECK (origem IN ('manual','formulario','busca'))`;
`evento_timeline.tipo` ganha `busca` (validado no código). `CREATE EXTENSION IF NOT EXISTS cube, earthdistance,
unaccent, pg_trgm`.

### 2.3 Catálogos em código (`lib/busca/catalogos.ts`, puros)

- **Tipos de evento** (globais, independentes das ocasiões por empresa): `casamento`, `aniversario`, `infantil`,
  `debutante`, `formatura`, `batizado`, `cha`, `confraternizacao`, `corporativo`, `coffee_break`, `lancamento`.
- **Tipos de serviço**: `buffet_completo`, `finger_food`, `coquetel`, `empratado`, `churrasco`, `food_truck`,
  `coffee_break`, `doces_bolo`, `bar_bebidas`, `kids`.
- Mapeamento tipo de evento → `tipos_evento.slug` (`corporativo` ↔ `corporativo`/`coffee_break`/`lancamento`;
  resto ↔ `social`) e → ocasião por nome, usado ao criar o evento do pedido.

---

## 3. Catálogo de recursos e valores por plano

`lib/planos/recursos.ts` exporta `RECURSOS` (slug, rótulo, descrição, `tipo: 'booleano' | 'limite'`, grupo) e
`VALORES_PADRAO` por plano (também gravados pela migration). Resumo:

| Recurso | Busca | Essencial | Profissional | Prime | Completo |
|---|---|---|---|---|---|
| Módulos: `propostas` `clientes` `agenda` `cardapios` `staff` `espacos` `templates` `formularios` `documentos` `configuracoes` | ✗ | ✓ | ✓ | ✓ | ✓ |
| `inbox` `reunioes` `estoque` `financeiro` `pesquisas` `ia` | ✗ | ✗ (pesquisa e financeiro básicos: fase posterior) | ✓ | ✓ | ✓ |
| `usuarios` | 1 | 2 | 5 | 15 | -1 |
| `espacos` / `templates` / `cardapios_opcoes` / `formularios` / `documento_modelos` / `email_modelos` | 0 | 1/1/3/1/1/0 | 3/5/10/5/5/10 | 10/20/20/20/20/20 | -1 |
| `estoque_itens` / `ia_analises_mes` / `ia_fundos_mes` | 0 | 0/0/0 | 300/40/0 | 2000/150/20 | -1 |
| `busca` `busca_selo` `busca_prioridade` `busca_cardapios` `busca_disponibilidade` `busca_fotos_tags` `busca_aviso_email` | ✓ / ✗ demais | ✓ todos | ✓ todos | ✓ todos | ✓ todos |
| `busca_aviso_whatsapp` | ✗ | ✗ (até existir) | ✓ | ✓ | ✓ |
| `busca_fotos` / `busca_tipos_evento` / `busca_tipos_servico` | 5 / 3 / 3 | -1 | -1 | -1 | -1 |
| `historico_meses` | 3 | -1 | -1 | -1 | -1 |

Os valores dos pagos seguem `proposta-precificacao-planos.md` §6/§11. Na fase 1 aplicam-se **todos os booleanos de
módulo** e os limites `usuarios`, `espacos`, `templates`, `cardapios_opcoes`, `formularios`, `documento_modelos`,
`email_modelos`, `estoque_itens`, `ia_analises_mes`, `ia_fundos_mes` nos pontos de criação já mapeados na proposta
(§11.2). Os `busca_*` entram nas fases do Busca.

---

## 4. Feature gating

### 4.1 Função SQL (fonte única)

```
fn_tenant_entitlements(p_tenant uuid) → jsonb
{ tenant_id, plano_id, plano_slug, plano_nome, gratuito, publico,
  trial: { ate: date, dias_restantes: int } | null,          -- só quando plano pago e trial_ate >= hoje
  trial_vencido: bool,                                         -- plano pago, trial_ate < hoje (rebaixar)
  recursos: { slug: valor efetivo },                           -- override (hwesta_entitlements.capabilities) ?? planos.recursos
  override: {...}, sem_plano: bool }
```
`STABLE SECURITY DEFINER`, `GRANT EXECUTE` ao papel do app. Atalhos `fn_tenant_pode(uuid, text) → bool` e
`fn_tenant_limite(uuid, text) → int` para uso em SQL (ex.: recorte de histórico).

### 4.2 Biblioteca (`lib/planos/gating.ts`)

```ts
entitlements(tenantId)                      // cache 15 s por tenant; invalidar(tenantId) em toda transição
podeUsar(tenantId, recurso)                 // booleano; sem plano → true
limite(tenantId, recurso)                   // número; -1 → Infinity; sem plano → Infinity
dentroDoLimite(tenantId, recurso, usoAtual) // usoAtual < limite
recorteHistorico(tenantId)                  // Date | null (hoje − historico_meses)
exigir(tenantId, recurso)                   // lança ErroPlano('RECURSO_FORA_DO_PLANO')
exigirLimite(tenantId, recurso, contar)     // lança ErroPlano('LIMITE_DO_PLANO', {limite, uso})
```
`ErroPlano` é traduzido por `userMessage()` e por `jsonEndpoint` em `403 { code, recurso, limite, uso, upgrade_url: '/planos' }`.
`lib/planos/rotas.ts` (puro, testado): `recursoDaRota(pathname) → slug | null`, prefixo mais específico primeiro:

| Prefixos | Recurso |
|---|---|
| `/dashboard`, `/eventos`, `/api/eventos`, `/api/orcamentos`, `/print/orcamento`, `/print/compras` | `propostas` |
| `/inbox` | `inbox` · `/clientes` → `clientes` · `/agenda` → `agenda` · `/reunioes`, `/api/google` → `reunioes` |
| `/cardapio`, `/api/cardapio` → `cardapios` · `/staff` → `staff` · `/espacos` → `espacos` · `/estoque` → `estoque` |
| `/templates`, `/api/templates`, `/print/template` → `templates` · `/formularios`, `/api/formularios` → `formularios` |
| `/documentos`, `/print/documento` → `documentos` · `/pesquisas`, `/api/pesquisas` → `pesquisas` |
| `/financeiro`, `/api/financeiro`, `/eventos/:id/financas` → `financeiro` · `/eventos/:id/negociacao`, `assistente-orcamento`, `ia-contexto` → `ia` |
| `/configuracoes`, `/api/configuracoes` → `configuracoes` |
| Livres: `/busca`, `/api/busca`, `/planos`, `/api/planos`, `/conta`, `/suporte`, `/api/suporte`, `/api/sessao`, `/uploads`, `/busca-media`, públicas |

Middleware: depois da autorização, `recurso = recursoDaRota(pathname)`; se `recurso && !podeUsar()` → API 403 JSON;
página → redirect para `inicioDoPlano(ent) + '?bloqueado=' + recurso`. `inicioDoPlano`: `/busca` quando `propostas`
é falso, senão `/dashboard` (também usado no login, verificação, Google e `/`).

### 4.3 Menu e interface

- `nav.ts`: `recurso?: string` por item; `Sidebar`/`MobileNav` marcam `nav-item--bloqueado` (cadeado Tabler `lock`,
  cor rebaixada, `aria-disabled`, `title` "não incluído no seu plano", href `?bloqueado=`); submenus idem.
- Item **Banket Busca** (`/busca`, `recurso: 'busca'`, sempre liberado): marca própria (`logo-mark.png` + pill
  "busca", classe `.nav-busca`), badge "Publique seu perfil" enquanto `busca_perfis.publicado = false`
  (consulta no `AppLayout` junto do contador do Inbox).
- Card do plano no rodapé do menu (owner/admin): gratuito → "Plano Busca · Iniciar teste grátis" (ou "Ver planos"
  se já usou o trial); trial → "Teste do Profissional · restam N dias · Falar com a equipe".
- Painel de upsell (`components/planos/Upsell.astro` + `lib/planos/upsell.ts` no navegador): abre com
  `?bloqueado=`, com `fetch` que receba `RECURSO_FORA_DO_PLANO`/`LIMITE_DO_PLANO` (sem alterar a resposta) e no
  clique dos cadeados. Conteúdo por recurso (benefício em pt-BR), números reais do tenant quando houver, e os CTAs:
  "Iniciar teste grátis de 30 dias" (se disponível) / "Ver planos" / "Falar com a equipe". Registra
  `busca_upsell_eventos`.
- Página `/planos` (todos os papéis; só owner/admin agem): comparação Gratuito × Essencial × Profissional × Prime
  lida do catálogo, trial, link para a demonstração do site.

### 4.4 Pontos de limite e histórico

| Limite | Onde (servidor) |
|---|---|
| `usuarios` | `server/convites.ts` (convite), `server/usuarios.ts` (reativar); contagem = vínculos ativos + convites pendentes |
| `espacos`, `templates`, `cardapios_opcoes`, `formularios`, `documento_modelos`, `email_modelos` | criação, duplicação e reativação nos módulos (proposta §11.2) |
| `estoque_itens` | `server/estoque.ts` (criar, `sincronizarItemCardapio`) |
| `ia_analises_mes`, `ia_fundos_mes` | `server/ia/comum.ts`, `server/imagemFundo.ts` (contagem do mês, fuso SP) |
| `busca_fotos`, `busca_tipos_evento`, `busca_tipos_servico` | `server/busca/{fotos,perfil}.ts` |
| `historico_meses` | `server/busca/pedidos.ts` (lista e thread), `listarTimeline`/`conversas` quando acessados pela área do Busca: `WHERE created_at >= recorte` |

Listagens mostram "4 de 5" (`.uso-plano`) e, no teto, o botão de criar abre o upsell.

---

## 5. Ciclo de vida do plano (`server/planos.ts`)

| Função | O que faz |
|---|---|
| `trocarPlano(db, tenantId, paraPlanoId, {motivo, origem, usuarioId, dados})` | `UPDATE tenants`, histórico, `invalidar()`, `busca_perfis.nivel`, `restaurar`/`aplicarExcedentes` conforme o destino. Único ponto de escrita de `plano_id` |
| `iniciarTrial(db, user, planoId)` | owner/admin; só se `trial_usado_em IS NULL` e plano atual gratuito; `trial_ate = hoje+trial_dias`, `trial_iniciado_em = trial_usado_em = now()`; `trocarPlano(motivo 'trial_iniciado')`; upsell `trial_iniciado`; e-mail "Seu teste começou" |
| `recusarTrial(db, user)` | `trial_recusado_em`; por 30 dias o upsell mostra só "Ver planos" |
| `rebaixarParaBusca(db, tenantId, motivo)` | só se plano pago **e** (`trial_vencido` ou motivo explícito do Manager/Stripe); `trocarPlano` + `plano_rebaixado_em` + excedentes + e-mail "Seu período de teste terminou" + upsell `rebaixado` |
| `aplicarExcedentes(db, tenantId)` | usuários: mantém owner + mais recentes até o limite, demais `ativo=false, bloqueado_plano_em=now()` (`invalidateMembership`); fotos: `bloqueado_plano_em` nas que excedem (mantém capa e ordem); tipos: corta os arrays e guarda em `excedentes`; nada apagado |
| `restaurarAposUpgrade(db, tenantId)` | limpa `bloqueado_plano_em` (usuários voltam a `ativo`), restaura arrays, `plano_rebaixado_em = NULL` |
| `aplicarDoManager(tenantId, {plan_slug, status, capabilities})` | chamado pelo adapter HCP: `plan_slug` existente → `trocarPlano(motivo 'hwesta')`; `capabilities` → override em `hwesta_entitlements`; `status` só informativo |
| `cadastroInicial(db, tenantId, origem)` | `busca` → plano Busca; `site` → plano Profissional com `trial_ate = hoje+30`; histórico `cadastro` |

**Agendador** (`server/agendador.ts`, `setInterval` de 10 min, iniciado uma vez no módulo do middleware): (1) rebaixa
tenants com `trial_vencido` quando `now()` no fuso SP ≥ 12h do dia seguinte a `trial_ate`; (2) envia avisos D-7, D-1
e D0 (9h SP) com dedup em `plano_avisos` (`INSERT … ON CONFLICT DO NOTHING` decide quem envia). Cada tenant num
`try/catch`. Complemento: `gating.entitlements()` também rebaixa de forma preguiçosa ao detectar `trial_vencido`
depois do horário, para não depender do intervalo.

**HCP** (`adapter.ts`): `capabilities.plans_catalog = true`, `listPlans()` lê `planos` (`publico`), `getAccount`
devolve `plan_slug`, `status` (`trial` quando em trial, `active` demais), `trial_ends_at`; `applyEntitlements` →
`aplicarDoManager`. Documentar em `INTEGRACAO_HWESTA.md` e combinar com o Manager a sincronização do catálogo.

---

## 6. Rotas

### 6.1 Vitrine (`busca.banket.com.br`, arquivos em `src/pages/vitrine/`)

| Rota pública | Arquivo | Conteúdo |
|---|---|---|
| `/` | `index.astro` | buscador guiado (tipo, cidade, data, convidados), categorias, como funciona, destaques (clientes publicados com melhor pontuação), depoimentos reais (avaliações 5★ recentes), chamada para buffets |
| `/buscar?tipo&cidade&data&convidados&servico[]&preco_max&local=domicilio|espaco&avaliacao&raio&ordem&pagina` | `buscar.astro` | resultados, filtros na URL, ordenação (`relevancia`, `preco`, `avaliacao`, `distancia`), 12 por página, seleção múltipla (ilha), estado vazio com sugestões |
| `/buffet/[slug]` | `buffet/[slug].astro` | perfil público |
| `/buffet/[tipo]/[cidade]` | `buffet/[tipo]/[cidade].astro` | landing SEO (texto + resultados + perguntas) |
| `/orcamento?buffets=a,b,c&…` · `/orcamento/confirmacao/[grupo]` | `orcamento.astro`, `orcamento/confirmacao/[grupo].astro` | pedido (drawer no desktop, página completa sem JS) e confirmação |
| `/para-buffets` | `para-buffets.astro` | comparação Gratuito × Banket + CTA `app.banket.com.br/auth/cadastro?plano=busca` |
| `/avaliar/[token]` | `avaliar/[token].astro` | avaliação (GET/POST, sem JS) |
| `/sitemap.xml`, `/robots.txt` | `.ts` | dinâmicos |
| `POST /api/vitrine/pedidos` · `GET /api/vitrine/cidades?q=` | `src/pages/api/vitrine/` | pedido (JSON e form), autocomplete |

Rewrite: `Host === BUSCA_HOST` → `next('/vitrine' + pathname)`; demais hosts → `/vitrine/*` 404. Todas públicas no
middleware (sem sessão), `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` nos GET sem cookie.

### 6.2 Área do buffet (`app.banket.com.br/busca`, menu "Banket Busca")

| Rota | Conteúdo |
|---|---|
| `/busca` | início: estado do perfil (publicado/etapas pendentes), métricas 30 dias (aparições, visualizações, pedidos, taxa de resposta, fechados), pedidos aguardando, card de upsell com números reais |
| `/busca/cadastro?etapa=1..7` | onboarding (progresso salvo por etapa); etapas 1 Empresa · 2 Eventos e serviços · 3 Região · 4 Capacidade · 5 Pacotes · 6 Fotos · 7 Revisão e publicação; itens **Cardápios** e **Disponibilidade** listados com cadeado (gratuito) ou liberados (cliente) |
| `/busca/pedidos` · `/busca/pedidos/[id]` | lista com status e filtros; detalhe com thread (reuso de `inbox/Conversa.astro`), resposta, mudar status (fechado/perdido = `moverEvento`), aviso de upsell (gratuito) |
| `/busca/perfil` · `/busca/pacotes` · `/busca/fotos` · `/busca/regiao` | edição depois de publicado (drawers) |
| `/busca/cardapios` · `/busca/disponibilidade` | cliente: pacotes ↔ opções de cardápio; calendário com eventos aprovados + bloqueios; gratuito: painel "Exclusivo Banket" |
| `/busca/avaliacoes` | recebidas, responder, pedir avaliação (reenvia o link) |
| `/busca/previa` | prévia do perfil público (iframe da vitrine com `?previa=1`), banner "como ficaria com cardápios e selo" (gratuito) |
| `/busca/planos` → `/planos` | comparação e CTAs |
| APIs `src/pages/api/busca/`: `perfil` (PUT por etapa), `publicar`, `pacotes[/id]`, `fotos` (upload multipart, ordem, tags), `pedidos/[id]/{responder,status}`, `avaliacoes/[id]/responder`, `upsell` (POST evento), `cidades` (proxy do autocomplete) |
| `src/pages/api/planos/`: `trial` (POST iniciar / DELETE recusar) |
| `/busca-media/[tenant]/[...key]` | fotos e logos públicos (pasta `busca/`), `Cache-Control: public, max-age=86400` |

Permissões: owner/admin editam perfil, pacotes, fotos, região, publicam e iniciam trial; `usuario` vê métricas e
responde pedidos.

---

## 7. Onboarding (etapas e campos)

| Etapa | Campos | Pré-preenchimento (cliente Banket) | Validação |
|---|---|---|---|
| 1 Empresa | nome público, CNPJ (`lib/documento.ts`), logo, telefone, WhatsApp, e-mail, Instagram/site, descrição (≤ 1.200) | `tenants` (nome, documento, logo, telefone, e-mail) | zod; CNPJ válido |
| 2 Eventos e serviços | tipos de evento, tipos de serviço, restrições atendidas | — | limites `busca_tipos_*` |
| 3 Região | atende em domicílio (raio km a partir do endereço), espaço próprio (endereço com CEP → ViaCEP), cidades atendidas | `espacos` próprio (endereço, cidade) | ao menos um modo; cidade resolvida em `busca_cidades`; `lat/lng` = centroide |
| 4 Capacidade | mínimo, máximo, "aceito menores com valor mínimo" | `espacos.capacidade_*` | min ≤ max |
| 5 Pacotes | nome, descrição, o que inclui, preço por pessoa, faixa de convidados; cliente: "importar das opções de cardápio" | `cardapio_opcoes` | ≥ 1 pacote para publicar |
| 6 Fotos | upload múltiplo (compressão no navegador do `FileUpload`), ordem, capa; tags (pago) | — | ≥ 3 fotos para publicar; limite `busca_fotos` |
| 7 Revisão | prévia do card e do perfil, aceite dos termos para buffets, **Publicar** | — | etapas 1–6 completas |

`completude` (0–100) pesa: descrição ≥ 300 caracteres, logo, ≥ 5 fotos, ≥ 2 pacotes, região, capacidade, contato,
Instagram, tempo de resposta. Salvar cada etapa = `PUT /api/busca/perfil` com `etapa` → `etapa_concluida = max`.

---

## 8. Matching e ranking (`lib/busca/matching.ts`, `lib/busca/ranking.ts`)

**Pré-filtro em SQL** (`server/busca/publico.ts`, read only): `publicado AND tenants.status='active'`,
`tipo = ANY(tipos_evento)`, `(capacidade_min <= $conv AND capacidade_max >= $conv) OR (aceita_menor AND capacidade_min > $conv)`,
localização: `cidade_id = $cidade OR EXISTS busca_perfil_cidades OR (atende_domicilio AND earth_distance(ll_to_earth(lat,lng), ll_to_earth($lat,$lng)) <= raio_km*1000)`.
Devolve candidatos com `distancia_km`, `nivel`, `nota_media`, `total_avaliacoes`, `taxa_resposta`, `completude`,
`preco_min`, `disponivel_na_data` (só cliente: `NOT EXISTS evento aprovado na data` em `eventos`+`status_orcamento`
do tenant, `NOT EXISTS busca_bloqueios`).

**Predicados puros** (`matching.ts`, testados): `compativel(perfil, criterios)` repete a regra do SQL em memória
(filtros secundários: serviço, preço máximo, local, avaliação mínima) e `disponivel(perfil, data)`: cliente sem
disponibilidade na data → eliminado; gratuito → nunca eliminado (badge "Consultar disponibilidade").

**Pontuação** (`ranking.ts`):

```ts
PESOS = { completude: 0.30, avaliacao: 0.30, resposta: 0.20, distancia: 0.20 }   // configuráveis, somam 1
avaliacao = (nota_media / 5) * min(1, total_avaliacoes / 10)
resposta  = taxa_resposta (0..1) ou 0.5 sem histórico
distancia = 1 - min(d, raioBusca) / raioBusca   (raioBusca = raio do filtro ou 30 km)
pontos    = Σ peso × fator
ordem     = grupo (cliente antes de gratuito) → pontos desc → total_avaliacoes desc → nome
```
Ordenações alternativas (`preco`, `avaliacao`, `distancia`) mantêm o grupo cliente primeiro. Paginação depois de
ordenar. Testes: compatibilidade (cada critério), prioridade entre grupos, pesos, empates, data só elimina cliente.
Contadores: cada resultado renderizado soma `aparicoes`; cada perfil aberto soma `visualizacoes` (upsert diário,
conexão de sistema, sem cookie).

---

## 9. Pedido de orçamento, pedidos no funil e avaliação

1. `POST /api/vitrine/pedidos` (honeypot `_website`, 5 envios/10 min por IP, 10/dia por e-mail): valida (nome,
   e-mail, WhatsApp, tipo, data ≥ hoje, convidados, cidade, aceite), `grupo_id` novo.
2. Para cada buffet (`withTenant` do buffet): `clienteDoPedido` (reuso pelo e-mail ou cria PF), `criarEvento`
   (`origem 'busca'`, tipo/ocasião pelo catálogo, data, convidados, local, `comentario_cliente`, `responsavel_*`),
   `busca_pedidos`, `obterOuCriarConversa` + mensagem de **entrada** com o texto do pedido (sem envio),
   `registrarTimeline('busca', 'Pedido recebido pelo Banket Busca')`.
3. E-mails: confirmação ao solicitante (lista dos buffets, `emailLayout`); aviso ao buffet só se
   `busca_aviso_email` (pagos). Gratuito: contador "Pedidos aguardando resposta" no menu e no início.
4. Resposta do buffet: `enviarNaConversa` (sai por e-mail, `Reply-To` da conversa; respostas do cliente caem na
   mesma thread via webhook do Resend já existente); `respondido_em`, `taxa_resposta` recalculada.
5. Status: derivado (seção 2.7 da análise); fechar/perder usa `moverEvento` (com motivo/data como no Kanban).
6. Avaliação: ao marcar **fechado** e `data_evento` passada (ou pelo botão "Pedir avaliação"), gera token (30 dias,
   `lib/tokens.ts`) e envia o link `busca.banket.com.br/avaliar/<token>` ao e-mail do pedido; uma avaliação por
   pedido; publicada após moderação simples (nota + texto ≥ 20 caracteres; o buffet pode responder, nunca apagar).

---

## 10. Sincronização para o cliente Banket (`server/busca/sincronizacao.ts`)

| Dado | Fonte | Regra |
|---|---|---|
| Empresa | `tenants` | pré-preenche a etapa 1; edição no Busca não altera `tenants` (perfil público é cópia) |
| Espaço próprio | `espacos` (`tipo='proprio'`, padrão da empresa) | endereço, cidade, capacidade na etapa 3/4 |
| Cardápios | `cardapio_opcoes` + seções/itens | pacote com `cardapio_opcao_id` mostra seções e itens (com restrições) no perfil; preço por pessoa pode vir da opção ou ser manual; "importar" cria pacotes a partir das opções ativas |
| Disponibilidade | `eventos` aprovados na data (+ `busca_bloqueios`) | selo "Disponível em dd/mm" e filtro por data; calendário na área do buffet com os dois |
| Pedido | `criarEvento` | sempre (os dois perfis); o Kanban só aparece nos planos com `propostas` |

Tudo lido ao vivo; nada duplicado. Se a empresa é rebaixada, `nivel = 'gratuito'` e as leituras acima deixam de
aparecer na vitrine (os pacotes continuam, sem o cardápio).

---

## 11. SEO

- `VitrineLayout.astro`: `<title>`, description, canonical (`BUSCA_URL`), Open Graph/Twitter, `lang=pt-BR`,
  JSON-LD por página (`WebSite`+`SearchAction` na home; `ItemList` nos resultados; `LocalBusiness`/`FoodEstablishment`
  + `AggregateRating` + `Offer` por pacote no perfil; `FAQPage` nas landings), `robots` `noindex` em `/orcamento*`,
  `/avaliar/*` e em páginas de resultado sem resultados.
- `sitemap.xml`: home, `/para-buffets`, perfis publicados (`lastmod = updated_at`), landings tipo × cidade com ≥ 1
  perfil compatível. `robots.txt` com o sitemap.
- Landings `/buffet/[tipo]/[cidade]`: título "Buffet para {tipo} em {cidade}", texto fixo por tipo
  (`lib/busca/seo.ts`), resultados do pré-filtro, perguntas frequentes, links para cidades vizinhas (50 km).
- Cache: `s-maxage` no Cloudflare; `Vary: Cookie` ausente nas páginas públicas (sem sessão).
- Desempenho: imagens com `loading="lazy"`, `width/height`, fotos comprimidas no upload (já existe `comprimirKb`);
  sem JS nas páginas de SEO além das ilhas de filtro/seleção.

---

## 12. Upsell e eventos de funil

| Ponto de contato | Onde | Mensagem (dados reais) | Evento |
|---|---|---|---|
| Cadeado em Cardápios/Disponibilidade e nos módulos do menu | onboarding, menu, submenus | benefício do recurso + "Iniciar teste grátis" | `cadeado_visto`, `cta_clicado` |
| Card no início do Busca | `/busca` | "Seu perfil apareceu em {aparicoes} buscas nos últimos 30 dias; clientes Banket aparecem primeiro" | `cta_clicado` |
| Pedido recebido (gratuito) | `/busca/pedidos/[id]` | "Com o Banket este pedido já estaria no seu funil e você geraria a proposta em PDF" | `cta_clicado` |
| Prévia do perfil | `/busca/previa` | banner "assim ficaria com cardápios e selo" | `cta_clicado` |
| Página de planos | `/planos` | comparação lida do catálogo | `planos_visitado` |
| Trial | `iniciarTrial`/`recusarTrial` | — | `trial_iniciado`, `trial_recusado` |
| Conversão / rebaixamento | `trocarPlano` | — | `assinatura_concluida`, `rebaixado` |

Relatório: `GET /api/hwesta/v1/metrics/busca-funil?de&ate` (Bearer do Manager) com cadastros Busca por origem,
publicados, taxa de publicação, cadeados vistos por recurso, trials iniciados, conversões, tempo médio até o trial;
visão SQL `v_busca_funil_tenants`.

---

## 13. Seed de demonstração (`db/seeds/010_busca_demo.sql`, só dev)

- Planos: já vêm da migration. Tenants demo: Banket (Completo), Outro Buffet → **Profissional**, mais 10 tenants novos
  (`busca-demo-*`, senha `Banket.2026`): 6 no plano Busca e 4 clientes (2 Essencial, 1 Profissional, 1 Prime, um
  deles em trial).
- Perfis publicados em São Paulo (Moema, Vila Mariana, Tatuapé), Campinas, Santo André, São Bernardo do Campo, São
  Caetano do Sul e Diadema; mistura de domicílio/espaço próprio; capacidades 30–600; pacotes de R$ 65 a R$ 220 por
  pessoa; 3–8 fotos (SVG/JPEG de `public/busca-demo/`), avaliações 3–5★ com textos realistas, métricas de 60 dias,
  alguns pedidos em cada status, um perfil incompleto (não publicado) e um no limite de fotos.
- Clientes Banket com `cardapio_opcoes` ligadas aos pacotes e eventos aprovados em datas próximas (para o selo).
- `busca_cidades`: a migration `033` traz todos os municípios; o seed só referencia.

---

## 14. Testes

| Tipo | Arquivo | Cobre |
|---|---|---|
| Unit | `lib/planos/rotas.test.ts`, `lib/planos/gating.test.ts` (com `fn` simulada), `lib/planos/recursos.test.ts` | prefixo → recurso, sem plano = permissivo, override, limites −1, recorte de histórico |
| Unit | `server/planos.test.ts` (funções puras: excedentes, datas D+1 12h, avisos) | quem fica/quem bloqueia, fuso SP |
| Unit | `lib/busca/matching.test.ts`, `ranking.test.ts`, `catalogos.test.ts`, `seo.test.ts`, `geo.test.ts` | compatibilidade, prioridade, pesos, disponibilidade só para cliente, JSON-LD, distância |
| Unit | `server/busca/pedidos.test.ts` (derivação de status), `lib/busca/completude.test.ts` | status, completude |
| E2e | `tests/e2e/planos.spec.ts` | empresa Completo sem regressão (menu sem cadeado, módulos abrem); conta Busca: menu com cadeados, `/eventos` → `/busca?bloqueado=propostas`, API 403, `/planos`, iniciar trial → menu abre, segundo trial 409, rebaixamento simulado (`trial_ate` no passado + chamada ao agendador) → excedentes |
| E2e | `tests/e2e/busca-publico.spec.ts` | home, resultados com filtros na URL, ordem cliente > gratuito, selo e "Disponível", perfil (cardápio só cliente), landing, sitemap, robots, não exposição (perfil não publicado/tenant suspenso) |
| E2e | `tests/e2e/busca-pedido.spec.ts` | pedido a 2 buffets → 2 eventos + conversas, e-mail no log, resposta pelo painel, status, avaliação pelo link |
| E2e | `tests/e2e/busca-onboarding.spec.ts` | cadastro `?plano=busca` → verificação → `/busca`, 7 etapas, limites (4º tipo, 6ª foto), publicar, prévia, cadeados |
| E2e | `tests/e2e/busca-cliente.spec.ts` | menu no tenant pago, pré-preenchimento, importar cardápios, disponibilidade |

E2e seguem o padrão da casa (seeds, série, limpeza, e-mails `@example.com`).

---

## 15. Fases

Cada fase termina com `npm run build`, `npx astro check`, `npm test`, e2e da fase e a lista do que validar à mão.
Correspondência com as fases do briefing entre parênteses.

| Fase | Entrega | Validação |
|---|---|---|
| **1. Planos e gating** (pré-requisito) | migration `031`, catálogo e backfill, `fn_tenant_entitlements`, `lib/planos/*`, `server/planos.ts`, middleware (gate + início por plano), menu com cadeado e card do plano, upsell, `/planos`, trial, agendador e avisos, HCP (`plans_catalog`, troca de plano, override), pontos de limite dos pagos, docs | `planos.spec.ts`; empresas atuais sem cadeado; conta no plano Busca só vê o menu Busca (vazio nesta fase); Manager lista o catálogo |
| **2. Estrutura, banco e seed do Busca** (1) | migrations `032`/`033`, extensões, catálogos, `storage` pasta `busca/`, `/busca-media`, `server/busca/*` base, seed demo, layout `VitrineLayout`/`busca.css` | migrations em dev; seed carrega; `/busca-media` serve só a pasta pública |
| **3. Vitrine e ranking** (2) | home, resultados, perfil, landings, matching/ranking, contadores, rewrite por host, cache | `busca-publico.spec.ts`; Lighthouse mobile ≥ 90 nas públicas |
| **4. Cadastro gratuito e onboarding** (3) | `?plano=busca` no autoatendimento, `/busca` início, 7 etapas, limites, publicação, prévia, cadeados Cardápios/Disponibilidade | `busca-onboarding.spec.ts` |
| **5. Menu e cliente Banket** (4) | item com marca + "Publique seu perfil", sincronização (empresa, espaços, cardápios, disponibilidade), `/busca/cardapios`, `/busca/disponibilidade`, selo e prioridade | `busca-cliente.spec.ts` |
| **6. Pedidos, funil e dashboard** (5) | pedido na vitrine, evento + conversa, e-mails, tela de pedidos com thread e status, avaliações, métricas do início, recorte de histórico | `busca-pedido.spec.ts` |
| **7. Upsell e funil** (6) | pontos de contato com números reais, `busca_upsell_eventos`, banner da prévia, relatório HCP, `/para-buffets` | eventos gravados; endpoint do Manager |
| **8. SEO e deploy** (7) | JSON-LD, sitemap, robots, Open Graph, cache; Nginx + Certbot + DNS, `.env`, `CLAUDE.md`, `DEPLOY.md` | Rich Results Test, `curl -I` com cache, deploy blue-green, e2e contra a VPS |

Ordem de deploy em produção: fase 1 sozinha (dia 1, com o Manager empurrando/lendo o catálogo), depois fases 2–3
juntas (vitrine só entra no ar com o vhost), e o restante incremental.

---

## 16. Variáveis de ambiente e infraestrutura

| Variável | Uso |
|---|---|
| `BUSCA_URL` (`https://busca.banket.com.br`) | links absolutos, canonical, sitemap, e-mails do Busca |
| `BUSCA_HOST` (`busca.banket.com.br`) | rewrite por host no middleware; vazio em dev (`/vitrine/*` direto) |
| `BUSCA_RANKING_PESOS` (opcional, JSON) | sobrescreve `PESOS` sem deploy |

Host: registro DNS (Cloudflare, proxy), `/etc/nginx/sites-enabled/busca.banket.com.br.conf` → upstream `banket_app`,
`real_ip` do Cloudflare nos dois vhosts, Certbot. Nenhum contêiner novo.

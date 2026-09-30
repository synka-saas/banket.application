# Integração com o Manager Hwesta (HCP v1)

O Banket implementa o **HCP v1** (Hwesta Connect Protocol), o contrato único pelo qual o Manager Hwesta
(`manager.hwesta.tech`, contêiner `hwesta_manager`) enxerga as empresas e os usuários, suspende/reativa contas,
aplica planos e centraliza os chamados de suporte. O Manager **nunca** lê o banco do Banket: tudo é HTTP pelas rotas
`/api/hwesta/v1/*`. O contrato completo está em `/var/www/.claude/skills/integrar-gestao/PROTOCOLO.md`.

## O que o Banket declara (`GET /api/hwesta/v1/ping`)

| Capability | Valor | Observação |
|---|---|---|
| `accounts`, `users` | sim | `tenants` e `tenant_usuarios` + `usuarios` |
| `kill_switch` | sim | `tenants.status` (`active` / `suspended` / `canceled`), conferido a cada requisição |
| `entitlements_push` | sim | o Manager é o catálogo de planos; aqui fica só o snapshot |
| `plans_catalog` | **não** | o Banket não tem planos próprios |
| `users_status` | sim | liga/desliga o vínculo (`tenant_usuarios.ativo`); o último proprietário ativo não pode ser desativado (409) |
| `users_reset_password` | **não** | o usuário redefine a senha sozinho em `/auth/recuperacao` |
| `events`, `tickets` | sim | eventos ficam em `hwesta_events`; chamados pela tela **Suporte** |

## Arquivos

| Caminho | Papel |
|---|---|
| `src/lib/hwesta/adapter.ts` | **Único arquivo específico do Banket**: traduz o contrato para `tenants`/`usuarios` (conexão de sistema) |
| `src/lib/hwesta/{types,handlers,auth,client,support,entitlements,index}.ts` | Núcleo genérico do HCP, igual em todos os apps. Não editar aqui: a origem é a skill `integrar-gestao` |
| `src/lib/hwesta/hwesta.test.ts` | Unitários do núcleo (Bearer, assinatura, capabilities, kill-switch, eventos, entitlements) |
| `src/pages/api/hwesta/v1/**` | Rotas chamadas pelo Manager (Bearer `HWESTA_MANAGER_KEY`); públicas no middleware |
| `src/pages/api/suporte/tickets/**` | API JSON de chamados do usuário logado (exige sessão) |
| `src/server/suporte.ts`, `src/pages/suporte/` | Tela **Suporte**: lista, novo chamado e conversa (item no menu em `lib/nav.ts`) |
| `src/pages/conta-suspensa.astro` | Aviso mostrado à empresa suspensa/cancelada |
| `src/lib/membership.ts`, `src/middleware.ts` | Kill-switch (ver abaixo) |
| `db/migrations/017_hwesta_integracao.sql` | `tenants.status`/`suspenso_em`/`suspenso_motivo`, `hwesta_entitlements`, `hwesta_events` |

## Variáveis de ambiente

```
HWESTA_APP_ID=banket
HWESTA_MANAGER_URL=http://hwesta_manager:4329   # rede docker hwesta_external_net
HWESTA_APP_KEY=        # app → Manager (abrir/consultar chamados)
HWESTA_MANAGER_KEY=    # Manager → app (rotas /api/hwesta/v1 e assinatura dos eventos)
```

As duas chaves são geradas por `scripts/register-platform.sh` da skill, que as grava direto no `.env`.
**Nunca** vão para o git, log ou documentação. Sem `HWESTA_MANAGER_KEY` as rotas `/api/hwesta/v1` respondem 503
(integração desligada, nunca aberta); sem `HWESTA_APP_KEY` a tela Suporte avisa que está indisponível. É o que
acontece no ambiente de dev, cujo compose não repassa essas variáveis.

Em produção (`docker-compose.prod.yml`) blue e green entram na rede externa `hwesta_external_net` com o alias
`banket` (o Manager chama `http://banket:4321`); o Postgres continua só na rede `default`.

## Kill-switch

1. O Manager chama `PATCH /api/hwesta/v1/accounts/:id/status` com `suspended`, `canceled` ou `active`.
2. O adapter grava `tenants.status` e chama `invalidateTenant()`, que derruba o cache de `getMembership` da empresa.
3. O middleware lê `membership.tenantStatus` a cada requisição: fora de `active`, páginas redirecionam para
   `/conta-suspensa` e `/api/*` responde `403 { code: 'ACCOUNT_SUSPENDED' }`. Só `/conta-suspensa` e
   `/api/sessao/empresa` (trocar de empresa) continuam acessíveis; `/auth/logout` é público.

Pontos de atenção:

- O cache de membership é por processo (30 s). Durante a troca blue-green, a cor que não recebeu a chamada pode
  levar até 30 s para barrar. Com uma cor só no ar (o normal), o bloqueio vale na requisição seguinte.
- O formulário público (`/f/:slug`) de uma empresa suspensa **continua recebendo pedidos**: a suspensão tira o
  acesso dos usuários, não descarta contatos de clientes do buffet.
- `suspenso_motivo` é interno (vem do operador do Manager) e não é mostrado ao usuário.

## Planos e limites (`can` / `limit`)

O Manager empurra o plano da empresa por `PUT /api/hwesta/v1/accounts/:id/entitlements`; o snapshot fica em
`hwesta_entitlements` (uma linha por empresa, RLS por tenant). **Empresa sem snapshot não sofre restrição.**
Hoje nenhum limite é aplicado no Banket. Para aplicar um:

```ts
import { can, limit, withinLimit } from '../lib/hwesta';

if (!(await withinLimit(tenantId, 'max_usuarios', usuariosAtivos))) {
  throw new UserError('O plano da empresa atingiu o limite de usuários.');
}
if (!(await can(tenantId, 'exportar_pdf'))) { /* recurso fora do plano */ }
```

As chaves (`max_usuarios`, `exportar_pdf`…) são as `capabilities` do plano cadastrado no Manager em
`/plataformas/<id>`. Chave ausente = liberado (`can`) ou sem limite (`limit`); `-1` também significa sem limite.
O snapshot é lido com cache de 60 s, invalidado quando o Manager empurra um novo.

## Suporte

- O usuário abre e acompanha chamados em **Suporte** (`/suporte`). Cada usuário vê os chamados que abriu na
  empresa atual; a regra fica em `server/suporte.ts` porque o Manager não conhece as sessões do Banket.
- Os chamados vivem no Manager (`/helpdesk/chamados`), com a plataforma, a empresa (`tenant_id`), o usuário e o
  contexto (página de origem, versão, navegador).
- A resposta do suporte aparece na conversa ao abrir o chamado (lida do Manager na hora) e também chega como
  evento `ticket.message` em `POST /api/hwesta/v1/events`, gravado em `hwesta_events`. O Banket ainda não tem
  central de notificações: quando houver, o ponto de disparo é `onEvent` no adapter.
- Eventos são assinados (`X-Hwesta-Signature`, HMAC-SHA256 do corpo com `HWESTA_MANAGER_KEY`) e idempotentes
  pelo id da entrega.

## Como conferir

```bash
npm test                                                   # inclui src/lib/hwesta/hwesta.test.ts
/var/www/.claude/skills/integrar-gestao/scripts/verify.sh banket   # de dentro da rede do Manager; tudo tem de dar "ok"
```

No Manager: `/plataformas/<id>` → **Testar conexão** e **Sincronizar agora**; `/clientes` com a plataforma Banket
selecionada → **Ver detalhes** abre a empresa com usuários, plano e kill-switch. Teste de suspensão só com empresa
de teste, nunca de cliente.

## Armadilhas

- Blue e green compartilham a rede `hwesta_external_net` com outros projetos. O app resolve o banco pelo nome
  `postgres`: nenhum outro contêiner dessa rede pode ter o alias `postgres`, senão o nome fica ambíguo. Bancos
  não entram na rede compartilhada.
- O adapter usa `systemQuery`/`withSystem` (ignora RLS) de propósito: o Manager opera sobre todas as empresas.
  Não reutilize essas funções em fluxo com empresa definida.
- Rollback para uma cor construída antes da integração tira o Banket do ar **para o Manager** (sem rede e sem
  chaves): o app segue funcionando, mas o Manager perde a conexão até o próximo deploy.
- Trocar as chaves (`register-platform.sh … --rotate`) exige novo deploy para o contêiner ler o `.env`.

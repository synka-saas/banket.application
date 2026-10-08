# Comunicações atuais do Banket

Inventário de tudo o que o Banket envia hoje (código da branch `main` em 08/10/2026 e banco de produção consultado só
com SELECT). Serve de base para o desenho das jornadas de relacionamento. A mesma tabela está em
[comunicacoes-atuais.csv](comunicacoes-atuais.csv) (UTF-8, separador `;`).

**Como ler**

- Uma linha por mensagem (evento × destinatário × canal). A coluna Observações começa com **[Confirmado]** (visto no
  código) ou **[Inferido]** (dedução sem prova no código).
- O projeto não usa Fastify: o backend é o próprio **Astro SSR** (`src/pages`, `src/server`, `src/lib`). A varredura
  cobriu essas pastas, `db/migrations`, `scripts/`, `site/` e o crontab da VPS.
- Segredos aparecem só pelo nome da variável. Do banco, só contagens e estrutura.

## 1. Resumo

Foram encontradas **33 comunicações** (32 ativas e 1 inativa).
Delas, 31 estão confirmadas no código e 1 é inferida (lembrete do Google Agenda).
O agendamento de demonstração do site está confirmado pela documentação, mas o texto do e-mail fica no Manager Hwesta, fora deste repositório.

Só **11 e-mails saem de fato pelo Banket** (Resend): 6 de acesso, 1 de captação e 4 escritos pelo usuário
(proposta, contrato, resposta e mensagem nova no Inbox). **Não existe nenhuma comunicação agendada própria**: sem cron, fila,
lembrete ou follow-up automático. Os únicos envios por evento do sistema são a confirmação de cadastro e o aviso de pedido recebido.

**Por canal (ativas)**

| Canal | Mensagens |
|---|---:|
| E-mail enviado pelo Banket (Resend) | 11 |
| E-mail manual (mailto:, fora do sistema) | 6 |
| WhatsApp (link wa.me, manual) | 5 |
| Google Agenda (e-mail/notificação do Google) | 4 |
| Tela / in-app | 3 |
| API de saída (Manager Hwesta) | 2 |
| E-mail do Manager Hwesta (site do Banket) | 1 |
| **Total** | **32** |

Canais não encontrados: WhatsApp por API, SMS, push (web-push, FCM, OneSignal) e tabela de notificações in-app.

**Por destinatário (ativas)**

| Destinatário | Mensagens |
|---|---:|
| Cliente final | 16 |
| Admin do Banket | 4 |
| Dono do buffet | 3 |
| Dono e equipe do buffet | 3 |
| Equipe do buffet | 3 |
| Fornecedor | 3 |
| **Total** | **32** |

Não há nenhuma comunicação para **convidados** do evento.

**Por tipo de disparo (ativas)**

| Tipo de disparo | Mensagens |
|---|---:|
| Manual | 25 |
| Evento | 6 |
| Agendado | 1 |
| **Total** | **32** |


## 2. Inventário

### Cadastro e acesso

| ID sugerido | Canal | Gatilho | Tipo de disparo | Destinatário | Remetente e marca | Assunto ou título | Texto atual | Variáveis usadas | Template | Anexos | Provedor | Condições de envio | Personalizável pelo buffet? | Registra log ou status de entrega? | Opt-out ou consentimento | Status | Arquivo:linha | Observações |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| acesso.verificacao_email | E-mail | Cadastro de conta em /auth/cadastro (novo ou cadastro anterior nunca confirmado) | Evento | Dono do buffet (quem cria a conta) | Banket — endereço de MAIL_FROM (padrão no código: "Banket <nao-responda@banket.com.br>"); sem Reply-To | Confirme seu e-mail no Banket | Título: Confirme seu e-mail<br>Olá, {primeiro_nome}!<br>Falta pouco para começar a usar o Banket. Confirme seu e-mail para ativar a conta e cadastrar sua empresa.<br>O link vale por 24 horas.<br>[Botão] Confirmar e-mail → {APP_URL}/auth/verificar?token={token}<br>Se o botão não funcionar, copie e cole este link no navegador: {url}<br>Rodapé: Se você não criou uma conta no Banket, ignore este e-mail. | {primeiro_nome}, {token}, APP_URL | src/server/emails.ts (emailLayout) + texto fixo em src/server/autoatendimento.ts:49-61 | Nenhum | Resend (API HTTP, RESEND_API_KEY) | Cadastro válido; limite de 20 cadastros/hora por IP. Sem RESEND_API_KEY ou destinatário em domínio reservado (example.com, .test) só vai para o log | Não | Não. Só console.info quando não há envio real; o resend_id não é guardado (o webhook marca os status desses e-mails como "mensagem desconhecida" em resend_events) | Transacional, sem opt-out; aceite de termos obrigatório no cadastro | Ativo | src/server/autoatendimento.ts:60 (chamado em :106; página src/pages/auth/cadastro.astro:28) | [Confirmado] Enviado depois do COMMIT da conta: se o Resend falhar, o usuário vê o erro mas a conta já existe (pode reenviar em /auth/validacao). |
| acesso.verificacao_email_reenvio | E-mail | Botão de reenvio em /auth/validacao | Manual | Dono do buffet (conta ainda não confirmada) | Banket — endereço de MAIL_FROM (padrão no código: "Banket <nao-responda@banket.com.br>"); sem Reply-To | Confirme seu e-mail no Banket | Igual a acesso.verificacao_email (novo token; o anterior é invalidado) | {primeiro_nome}, {token}, APP_URL | src/server/emails.ts + src/server/autoatendimento.ts:49-61 | Nenhum | Resend | Só para e-mail cadastrado e não verificado; 3 pedidos / 15 min por IP+e-mail; não revela se o e-mail existe | Não | Não. Só console.info quando não há envio real; o resend_id não é guardado (o webhook marca os status desses e-mails como "mensagem desconhecida" em resend_events) | Transacional, sem opt-out | Ativo | src/server/autoatendimento.ts:119 → :60 (página src/pages/auth/validacao.astro:14) | [Confirmado] Falha de envio é engolida (.catch → console.error): a tela mostra sucesso mesmo sem envio. |
| acesso.redefinicao_senha | E-mail | Pedido em /auth/recuperacao (Esqueceu a senha) | Manual | Dono do buffet / equipe do buffet | Banket — endereço de MAIL_FROM (padrão no código: "Banket <nao-responda@banket.com.br>"); sem Reply-To | Redefinição de senha do Banket | Título: Redefinição de senha<br>Olá, {primeiro_nome}!<br>Recebemos um pedido para redefinir a senha da sua conta no Banket. O link vale por 1 hora.<br>[Botão] Criar nova senha → {APP_URL}/auth/redefinir?token={token}<br>Se o botão não funcionar, copie e cole este link no navegador: {url}<br>Rodapé: Se você não pediu a redefinição, ignore este e-mail: sua senha continua a mesma. | {primeiro_nome}, {token}, APP_URL | src/server/emails.ts + texto fixo em src/server/autoatendimento.ts:301-311 | Nenhum | Resend | E-mail existente; 10 pedidos/hora por IP e 3 / 15 min por e-mail; não revela se o e-mail existe | Não | Não. Só console.info quando não há envio real; o resend_id não é guardado (o webhook marca os status desses e-mails como "mensagem desconhecida" em resend_events) | Transacional, sem opt-out | Ativo | src/server/autoatendimento.ts:311 (página src/pages/auth/recuperacao.astro:18) | [Confirmado] Falha de envio engolida (.catch). Não há e-mail avisando que a senha FOI alterada. |
| acesso.link_acesso | E-mail | Pedido em /auth/link-acesso (entrar sem senha) | Manual | Dono do buffet / equipe do buffet | Banket — endereço de MAIL_FROM (padrão no código: "Banket <nao-responda@banket.com.br>"); sem Reply-To | Seu link de acesso ao Banket | Título: Seu link de acesso<br>Olá, {primeiro_nome}!<br>Use o botão abaixo para entrar no Banket. O link vale por 15 minutos e só pode ser usado uma vez.<br>[Botão] Entrar no Banket → {APP_URL}/auth/entrar?token={token}<br>Se o botão não funcionar, copie e cole este link no navegador: {url}<br>Rodapé: Se você não pediu este link, ignore este e-mail. | {primeiro_nome}, {token}, APP_URL | src/server/emails.ts + texto fixo em src/server/autoatendimento.ts:353-360 | Nenhum | Resend | Só contas com e-mail verificado; 10/hora por IP e 3 / 15 min por e-mail | Não | Não. Só console.info quando não há envio real; o resend_id não é guardado (o webhook marca os status desses e-mails como "mensagem desconhecida" em resend_events) | Transacional, sem opt-out | Ativo | src/server/autoatendimento.ts:360 (página src/pages/auth/link-acesso.astro:18) | [Confirmado] Falha de envio engolida (.catch). |
| acesso.convite_usuario | E-mail | Owner/admin convida pessoa em Configurações › Usuários | Manual | Equipe do buffet (pessoa convidada) | Banket — endereço de MAIL_FROM (padrão no código: "Banket <nao-responda@banket.com.br>"); sem Reply-To | Convite para {empresa} no Banket | Título: Você foi convidado para o Banket<br>Olá, {nome}!<br>{quem_convidou} convidou você para acessar a {empresa} no Banket como {papel}.<br>O convite é válido por 7 dias.<br>[Botão] Aceitar convite → {APP_URL}/auth/cadastro-convidado?token={token}<br>Se o botão não funcionar, copie e cole este link no navegador: {url}<br>Rodapé: Você recebeu este e-mail porque há uma ação associada ao seu endereço no Banket. | {nome}, {quem_convidou}, {empresa}, {papel} (proprietário \| administrador \| usuário), {token}, APP_URL | src/server/emails.ts + texto fixo em src/server/usuarios.ts:128-141 | Nenhum | Resend | Pessoa ainda não vinculada à empresa; convite anterior pendente para o mesmo e-mail é substituído; só owner convida owner | Não (o nome da empresa entra no texto) | Parcial: o convite fica em auth_tokens (tipo convite); a entrega não é registrada | Transacional, sem opt-out | Ativo | src/server/usuarios.ts:140 (chamado em :161; página src/pages/configuracoes/usuarios.astro:45) | [Confirmado] Enviado dentro da transação do withTenant: se o Resend falhar, o convite é desfeito. "convidado" no masculino fixo; papel em minúsculas. |
| acesso.convite_usuario_reenvio | E-mail | Botão Reenviar na lista de convites pendentes | Manual | Equipe do buffet (pessoa convidada) | Banket — endereço de MAIL_FROM (padrão no código: "Banket <nao-responda@banket.com.br>"); sem Reply-To | Convite para {empresa} no Banket | Igual a acesso.convite_usuario (novo token e nova validade de 7 dias) | Iguais a acesso.convite_usuario | src/server/usuarios.ts:128-141 | Nenhum | Resend | Convite ainda não usado | Não | Parcial: auth_tokens; entrega não registrada | Transacional, sem opt-out | Ativo | src/server/usuarios.ts:173 → :140 (página src/pages/configuracoes/usuarios.astro:37) | [Confirmado] {quem_convidou} passa a ser quem clicou em Reenviar, não quem convidou originalmente. |
| banket.contato_termos_privacidade | E-mail (link mailto:) | Leitura de /termos ou /privacidade | Manual | Admin do Banket (contato@banket.com.br) | Cliente do e-mail do próprio leitor (dono do buffet, equipe ou titular de dados) | — (mailto sem assunto) | — (mailto sem corpo) | Nenhuma | — | Nenhum | Cliente de e-mail do usuário | Clique no link | Não | Não | Não se aplica | Ativo | src/pages/termos.astro:60; src/pages/privacidade.astro:49 | [Confirmado] Único canal indicado para pedidos de titulares (LGPD). |

### Vendas / Kanban

| ID sugerido | Canal | Gatilho | Tipo de disparo | Destinatário | Remetente e marca | Assunto ou título | Texto atual | Variáveis usadas | Template | Anexos | Provedor | Condições de envio | Personalizável pelo buffet? | Registra log ou status de entrega? | Opt-out ou consentimento | Status | Arquivo:linha | Observações |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| vendas.pedido_recebido_cliente | E-mail | Envio do formulário público de captação (/f/:slug → POST /api/public/formularios/:slug) | Evento | Cliente final (quem preencheu o formulário) | Banket — endereço de MAIL_FROM (padrão no código: "Banket <nao-responda@banket.com.br>"); sem Reply-To. A marca no texto é a do buffet, mas o nome de exibição é "Banket" | Recebemos o seu pedido — {empresa} | Título: Recebemos o seu pedido!<br>Olá, {primeiro_nome}! (sem nome: "Olá!")<br>O seu pedido de orçamento chegou para a equipe de {empresa}, que vai analisar os detalhes do seu evento e retornar em breve.<br>Se lembrar de algum detalhe importante, é só responder este e-mail.<br>Rodapé: Você recebeu esta mensagem porque preencheu o formulário de {empresa}. | {primeiro_nome}, {empresa} | src/server/emails.ts + texto fixo em src/server/formularios.ts:370-383 | Nenhum | Resend | Campo e-mail preenchido; enviado depois do COMMIT do pedido (melhor esforço: falha só vai ao log); limite de 5 envios / 10 min por slug+IP e honeypot | Não (só o nome da empresa entra no texto) | Não. Só console.info quando não há envio real; o resend_id não é guardado (o webhook marca os status desses e-mails como "mensagem desconhecida" em resend_events). A timeline registra o pedido (formulario), não o e-mail | Nenhum. O formulário público não tem aceite de privacidade/consentimento | Ativo | src/server/formularios.ts:381 (rota src/pages/api/public/formularios/[slug].ts:29) | [Confirmado] Pede para "responder este e-mail", mas não há Reply-To: a resposta vai para o endereço de MAIL_FROM (nao-responda) e não chega ao buffet nem ao Inbox. |
| vendas.pedido_recebido_tela | Tela (página pública) | Fim do envio do formulário público | Evento | Cliente final | Buffet (página /f/:slug com o nome da empresa) | Tudo certo! | Tudo certo!<br>{mensagem_sucesso} (padrão: "Seu pedido foi recebido. Nossa equipe vai analisar as informações e entrar em contato em breve.")<br>Enviamos uma cópia da confirmação para o seu e-mail. (quando há e-mail)<br>Resumo do seu pedido (lista do que foi enviado) | {mensagem_sucesso} | src/pages/f/[slug].astro:29-31 e :136-142 | Nenhum | — | Envio aceito | Sim: mensagem de sucesso por formulário (formularios.mensagem_sucesso) | Sim: formulario_respostas (snapshot do pedido) | Não se aplica | Ativo | src/pages/f/[slug].astro:139-140 | [Confirmado] Afirma "Enviamos uma cópia da confirmação" sem saber se o e-mail saiu; o e-mail não traz cópia das respostas. |
| vendas.compartilhar_formulario_whatsapp | WhatsApp (link wa.me) | Botão "Enviar no WhatsApp" no diálogo Compartilhar de Formulários | Manual | Cliente final (lead em prospecção) | Número de WhatsApp pessoal de quem clica (buffet) | — | Conte o que você imagina para o seu evento: {url_formulario} | {url_formulario} | Texto fixo em src/pages/formularios/index.astro:160 | Nenhum | WhatsApp (wa.me, sem API) | Clique; o usuário escolhe o contato no WhatsApp | Não (texto fixo; pode ser editado no WhatsApp antes de enviar) | Não | Não se aplica | Ativo | src/pages/formularios/index.astro:113 (botão), :160 (link) | [Confirmado] O mesmo diálogo oferece copiar link, QR Code e código de incorporação (não são mensagens). |
| vendas.roteiro_negociacao_ia | Área de transferência (para WhatsApp, e-mail, ligação ou reunião) | Botão Copiar numa sugestão do Assistente de Negociação IA | Manual | Cliente final | O usuário, pelo canal que escolher | — | Roteiro gerado pela IA a cada análise (não há texto fixo) | Dados do evento enviados à IA | src/server/ia/negociacao.ts (JSON Schema da resposta, :185) | Nenhum | OpenAI (geração); envio fora do sistema | Análise gerada pelo usuário | Não | A análise fica em ia_analises; o envio, não | Não se aplica | Ativo | src/pages/eventos/[id]/negociacao.astro:116 | [Confirmado] O sistema não envia nada: só copia o texto. |
| inbox.contador_nao_lidas | In-app (contador no menu) | E-mail do cliente recebido pelo webhook do Resend | Evento | Equipe do buffet (dono da conversa; owner/admin veem todas) | Sistema | — | Número de não lidas ao lado de Inbox no menu | nao_lidas | src/layouts/AppLayout.astro:37-38 | — | — | Calculado a cada página carregada (sem tempo real) | Não | Sim: mensagens/conversas | Não se aplica | Ativo | src/layouts/AppLayout.astro:37 | [Confirmado] É o único aviso de resposta do cliente: não há e-mail, push nem notificação para o usuário. |

### Orçamentos e propostas

| ID sugerido | Canal | Gatilho | Tipo de disparo | Destinatário | Remetente e marca | Assunto ou título | Texto atual | Variáveis usadas | Template | Anexos | Provedor | Condições de envio | Personalizável pelo buffet? | Registra log ou status de entrega? | Opt-out ou consentimento | Status | Arquivo:linha | Observações |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| proposta.envio | E-mail | Botão Enviar na aba Orçamento (drawer de envio da versão) | Manual | Cliente final (padrão: e-mail do responsável do evento, senão do cliente; até 5 destinatários) | Buffet — nome de exibição "{usuario} · {empresa}" no endereço de MAIL_FROM (domínio banket.com.br); Reply-To = r-{token}@RESEND_INBOUND_DOMAIN (sem o domínio: e-mail do usuário) | Do modelo padrão de e-mail; texto inicial da empresa: "Proposta de orçamento - {evento}" (editável no envio) | Modelo "Proposta padrão" (texto inicial, editável por empresa e no envio):<br>Olá {nome_cliente},<br><br>Agradecemos o interesse em realizar o seu evento conosco! Segue em anexo a proposta de orçamento para {evento}, no dia {data_evento}.<br><br>Qualquer dúvida, estamos à disposição.<br><br>{empresa}<br>Rodapé fixo: Proposta enviada por {empresa}. | {nome_cliente} {evento} {data_evento} {empresa} {valor_total} {versao} | Tabela email_modelos (texto inicial em db/migrations/004_configuracoes.sql:117-118, copiado pela 020); HTML em src/server/emailTexto.ts:16 (mensagemHtml) | PDF da proposta (capa + miolo + contracapa conforme o template), salvo em orcamentos/{eventoId}/v{n}.pdf | Resend; PDF por Chromium (playwright-core) + pdf-lib | Bloqueia o mesmo envio (versão + destinatários) por 60 s; se a versão estava aberta, ela é congelada e a próxima é criada | Sim: modelos de e-mail (nome, assunto, corpo, padrão), texto editável a cada envio e o visual do PDF (template). Não: remetente, layout HTML do e-mail, logo no e-mail | Sim: tabela mensagens (status enviada → entregue/devolvida/falhou pelo webhook do Resend, status_detalhe), conversas e evento_timeline (email_enviado); orcamento_versoes.enviado_em/enviado_para | Nenhum | Ativo | src/server/envio.ts:124 → src/server/conversas.ts:290 (página src/pages/eventos/[id]/orcamento.astro:48) | [Confirmado] {valor_total} é preenchido mesmo quando a versão esconde o total (mostrar_valor_total = false: envio.ts:49 lê total_visivel e não usa). PDF gerado de forma síncrona na requisição. |
| inbox.resposta | E-mail | Responder numa conversa do Inbox (/inbox/:id) | Manual | Cliente final (remetente da última mensagem recebida, ou os participantes) | Buffet — nome de exibição "{usuario} · {empresa}" no endereço de MAIL_FROM (domínio banket.com.br); Reply-To = r-{token}@RESEND_INBOUND_DOMAIN (sem o domínio: e-mail do usuário) | Re: {assunto_da_conversa} | Texto livre do usuário (pode partir de um modelo de e-mail via "Inserir modelo")<br>Rodapé fixo: Mensagem enviada por {usuario}. | Variáveis dos modelos, se usados; {usuario} | email_modelos (opcional) + src/server/emailTexto.ts:16 | Nenhum (não há upload de anexo na resposta) | Resend | Usuário comum só responde as próprias conversas; owner/admin, todas. In-Reply-To/References encadeiam a thread | Sim (texto livre e modelos) | Sim: tabela mensagens (status enviada → entregue/devolvida/falhou pelo webhook do Resend, status_detalhe), conversas e evento_timeline (email_enviado) | Nenhum | Ativo | src/server/conversas.ts:420 → :290 (página src/pages/inbox/[id].astro:24) | [Confirmado] |
| inbox.mensagem_nova | E-mail | Nova mensagem na aba Mensagens do evento | Manual | Cliente final (e-mails digitados, 1 a 5) | Buffet — nome de exibição "{usuario} · {empresa}" no endereço de MAIL_FROM (domínio banket.com.br); Reply-To = r-{token}@RESEND_INBOUND_DOMAIN (sem o domínio: e-mail do usuário) | Assunto digitado (com "Re:" quando a conversa do usuário no evento já existe) | Texto livre (pode partir de um modelo de e-mail)<br>Rodapé fixo: Mensagem enviada por {usuario}. | Variáveis dos modelos, se usados; {usuario} | email_modelos (opcional) + src/server/emailTexto.ts:16 | Nenhum | Resend | Abre ou reaproveita a conversa (evento, usuário) | Sim (texto livre e modelos) | Sim: tabela mensagens (status enviada → entregue/devolvida/falhou pelo webhook do Resend, status_detalhe), conversas e evento_timeline (email_enviado) | Nenhum | Ativo | src/server/conversas.ts:453 → :290 (página src/pages/eventos/[id]/mensagens.astro:26) | [Confirmado] Qualquer endereço pode ser digitado (não só o do cliente): também serve para fornecedores, sem distinção. |
| evento.email_cliente_mailto | E-mail (link mailto:) | Clique no e-mail do cliente no resumo do evento | Manual | Cliente final | Cliente de e-mail pessoal do usuário (fora do Banket) | — (sem assunto) | — (sem corpo) | Nenhuma | — | Nenhum | Cliente de e-mail do usuário | Cliente com e-mail | Não | Não (fora do Inbox) | Não se aplica | Ativo | src/pages/eventos/[id]/index.astro:115 | [Confirmado] Concorre com o Inbox: o que sai por aqui não fica no histórico do evento. |
| evento.email_responsavel_mailto | E-mail (link mailto:) | Clique no e-mail do responsável no resumo do evento | Manual | Cliente final (responsável pelo evento) | Cliente de e-mail pessoal do usuário | — (sem assunto) | — (sem corpo) | Nenhuma | — | Nenhum | Cliente de e-mail do usuário | Responsável com e-mail | Não | Não | Não se aplica | Ativo | src/pages/eventos/[id]/index.astro:138 | [Confirmado] |
| evento.whatsapp_cliente | WhatsApp (link wa.me) | Clique em "{telefone} · chamar" no resumo do evento | Manual | Cliente final | Número de WhatsApp pessoal de quem clica | — | — (abre a conversa sem texto) | {telefone} (DDI 55 acrescentado quando falta) | — | Nenhum | WhatsApp (wa.me, sem API) | Cliente com telefone | Não | Não (o usuário pode lançar uma anotação do tipo WhatsApp na linha do tempo) | Não se aplica | Ativo | src/pages/eventos/[id]/index.astro:117 (link montado em :75-78) | [Confirmado] |
| evento.whatsapp_responsavel | WhatsApp (link wa.me) | Clique no WhatsApp do responsável no resumo do evento | Manual | Cliente final (responsável) | Número de WhatsApp pessoal de quem clica | — | — (sem texto) | {responsavel_whatsapp} | — | Nenhum | WhatsApp (wa.me) | Responsável com WhatsApp | Não | Não | Não se aplica | Ativo | src/pages/eventos/[id]/index.astro:143 | [Confirmado] |

### Contratos

| ID sugerido | Canal | Gatilho | Tipo de disparo | Destinatário | Remetente e marca | Assunto ou título | Texto atual | Variáveis usadas | Template | Anexos | Provedor | Condições de envio | Personalizável pelo buffet? | Registra log ou status de entrega? | Opt-out ou consentimento | Status | Arquivo:linha | Observações |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| contrato.envio_documento | E-mail | Botão Enviar num documento gerado (aba Documentos do evento) | Manual | Cliente final (padrão: e-mail do responsável, senão do cliente; até 5) | Buffet — nome de exibição "{usuario} · {empresa}" no endereço de MAIL_FROM (domínio banket.com.br); Reply-To = r-{token}@RESEND_INBOUND_DOMAIN (sem o domínio: e-mail do usuário) | Título do documento (pré-preenchido, editável) | Texto digitado; o select Modelo (opcional, começa em "Nenhum") preenche com o corpo de um modelo de e-mail<br>Rodapé fixo: Documento enviado por {usuario}. | Variáveis dos modelos de e-mail, se usados; {usuario} | email_modelos (opcional) + src/server/emailTexto.ts:16 | PDF do documento (documentos/{eventoId}/{id}.pdf; reimpresso se faltar no disco) | Resend; PDF por Chromium | Documento já gerado | Sim: texto e modelos de e-mail; visual do PDF pela identidade do modelo de documento | Sim: tabela mensagens (status enviada → entregue/devolvida/falhou pelo webhook do Resend, status_detalhe), conversas e evento_timeline (email_enviado) | Nenhum | Ativo | src/server/documentos.ts:464 → src/server/conversas.ts:290 (página src/pages/eventos/[id]/documentos.astro:48) | [Confirmado] Não existe modelo de e-mail próprio para contrato: os modelos disponíveis nascem com o texto da proposta ("Segue em anexo a proposta de orçamento…"). Sem assinatura eletrônica nem acompanhamento de aceite. |

### Pagamentos

Não encontrado: nenhum envio relacionado a pagamentos, parcelas ou cobrança. `eventos.forma_pagamento` é só texto livre do briefing e as "Formas de pagamento" são um bloco de texto da proposta.

### Eventos

| ID sugerido | Canal | Gatilho | Tipo de disparo | Destinatário | Remetente e marca | Assunto ou título | Texto atual | Variáveis usadas | Template | Anexos | Provedor | Condições de envio | Personalizável pelo buffet? | Registra log ou status de entrega? | Opt-out ou consentimento | Status | Arquivo:linha | Observações |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| reuniao.convite | E-mail (convite do Google Agenda) + Google Meet | Agendar reunião na aba Reuniões do evento ou em /reunioes | Manual | Participantes digitados: cliente final (pré-preenchido com responsável/cliente), equipe do buffet ou terceiros | Conta Google do organizador (usuário do buffet); e-mail gerado pelo Google | Gerado pelo Google a partir de {titulo} e do horário (formato do Google) | Corpo gerado pelo Google com: {titulo}, data/hora (America/Sao_Paulo), {local}, link do Google Meet e descrição = {descricao} + "\n\nEvento: {titulo_evento}" | {titulo}, {descricao}, {titulo_evento}, {local}, {inicio}, {fim}, participantes | src/lib/google.ts:183-193 (corpoEvento) | Convite de calendário (gerado pelo Google) | Google Calendar API (sendUpdates=all) | Usuário com agenda Google ativa (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET + vínculo com escopo calendar.events) | Sim por reunião (título, descrição, local, participantes); não há modelo | Sim: tabela reunioes (google_event_id, meet_link, status) e timeline (reuniao); entrega não | Gerido pelo Google (o convidado pode recusar) | Ativo | src/lib/google.ts:210 (chamado em src/server/reunioes.ts:165) | [Confirmado] O texto do e-mail é do Google, no idioma da conta do organizador; não verificado. |
| reuniao.atualizacao | E-mail (atualização do Google Agenda) | Editar reunião agendada | Manual | Participantes da reunião | Conta Google do organizador | Gerado pelo Google (atualização do convite) | Gerado pelo Google com os dados novos | Iguais a reuniao.convite | src/lib/google.ts:183-193 | Convite atualizado | Google Calendar API (PATCH, sendUpdates=all) | Organizador ou owner/admin; reunião não cancelada | Sim por reunião | Sim: reunioes + timeline | Gerido pelo Google | Ativo | src/lib/google.ts:218 (chamado em src/server/reunioes.ts:197) | [Confirmado] Sai da agenda do organizador, mesmo quando um admin edita. |
| reuniao.cancelamento | E-mail (cancelamento do Google Agenda) | Cancelar reunião | Manual | Participantes da reunião | Conta Google do organizador | Gerado pelo Google (cancelamento) | Gerado pelo Google | {titulo}, data/hora | — | Cancelamento do convite | Google Calendar API (DELETE, sendUpdates=all) | Organizador ou owner/admin | Não | Sim: reunioes.status = cancelada + timeline | Gerido pelo Google | Ativo | src/lib/google.ts:228 (chamado em src/server/reunioes.ts:222) | [Confirmado] |
| reuniao.lembrete | Notificação/e-mail do Google Agenda | Antes do início da reunião | Agendado | Participantes com Google Agenda | Google | Gerado pelo Google | Gerado pelo Google | — | — | — | Google Calendar (reminders.useDefault = true) | Depende das configurações de lembrete de cada participante | Não | Não | Gerido pelo Google | Ativo | src/lib/google.ts:191 | [Inferido] Inferido: o Banket só pede os lembretes padrão; não há lembrete próprio do sistema. |
| staff.email_profissional | E-mail (link mailto:) | Clique no e-mail do profissional em Staff › Profissionais | Manual | Fornecedor (profissional de staff) | Cliente de e-mail pessoal do usuário | — | — | Nenhuma | — | Nenhum | Cliente de e-mail do usuário | Profissional com e-mail | Não | Não | Não se aplica | Ativo | src/pages/staff/profissionais.astro:66 | [Confirmado] |
| staff.whatsapp_profissional | WhatsApp (link wa.me) | Clique em "chamar no WhatsApp" em Staff › Profissionais | Manual | Fornecedor (profissional de staff) | Número de WhatsApp pessoal de quem clica | — | — (sem texto) | {telefone} | — | Nenhum | WhatsApp (wa.me) | Profissional com telefone | Não | Não | Não se aplica | Ativo | src/pages/staff/profissionais.astro:68 (link montado em :56-59) | [Confirmado] Não há convocação de staff por evento: nenhum envio automático aos profissionais. |
| espaco.email_contato | E-mail (link mailto:) | Clique no e-mail de contato no detalhe do espaço | Manual | Fornecedor (espaço de terceiro) | Cliente de e-mail pessoal do usuário | — | — | Nenhuma | — | Nenhum | Cliente de e-mail do usuário | Espaço com e-mail de contato | Não | Não | Não se aplica | Ativo | src/pages/espacos/[id].astro:160 | [Confirmado] |

### Assinatura do Banket

| ID sugerido | Canal | Gatilho | Tipo de disparo | Destinatário | Remetente e marca | Assunto ou título | Texto atual | Variáveis usadas | Template | Anexos | Provedor | Condições de envio | Personalizável pelo buffet? | Registra log ou status de entrega? | Opt-out ou consentimento | Status | Arquivo:linha | Observações |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| assinatura.conta_suspensa_tela | Tela (bloqueio no app) | Manager Hwesta muda tenants.status para suspenso ou cancelado (kill-switch) | Evento | Dono do buffet e equipe do buffet (qualquer acesso da empresa) | Banket | Acesso suspenso \| Conta encerrada | Suspensa: O acesso de {empresa} ao Banket está temporariamente suspenso. Para regularizar ou tirar dúvidas, fale com a gente em contato@banket.com.br.<br>Cancelada: A conta de {empresa} no Banket foi encerrada. Para regularizar ou tirar dúvidas, fale com a gente em contato@banket.com.br. | {empresa} | src/pages/conta-suspensa.astro:19-29 | — | — | Próxima página aberta depois da mudança (cache de 30 s) | Não | Status em tenants (suspenso_em, suspenso_motivo) | Não se aplica | Ativo | src/pages/conta-suspensa.astro:24-28 | [Confirmado] Ninguém é avisado por e-mail antes ou no momento da suspensão; o aviso só aparece ao tentar usar o app. |
| banket.contato_conta_suspensa | E-mail (link mailto:) | Clique no contato da tela de conta suspensa | Manual | Admin do Banket (contato@banket.com.br) | Cliente de e-mail do dono/equipe do buffet | — | — | Nenhuma | — | Nenhum | Cliente de e-mail do usuário | Empresa suspensa ou cancelada | Não | Não | Não se aplica | Ativo | src/pages/conta-suspensa.astro:28 | [Confirmado] |
| site.agendamento_demonstracao | E-mail + Google Meet + convite .ics | Agendar demonstração no formulário #contato do site banket.com.br | Evento | Dono do buffet (prospect do Banket) e equipe comercial do Banket | Manager Hwesta (agenda pública crm-banket), e-mail pelo Resend | Não verificado (texto no Manager) | Não verificado (texto no Manager, /var/www/hwesta/manager). Na tela o site mostra só o link do convite .ics; Meet e link de cancelamento chegam por e-mail | Não verificado | Fora deste repositório | .ics (download na tela) | Manager Hwesta → Resend + Google Meet | Horário livre; limite por IP e campo-isca no Manager; máximo de 3 agendamentos abertos por e-mail | Não se aplica (é do Banket) | No Manager (fora deste repositório) | Não verificado | Ativo | site/assets/js/site.js:463 (POST /api/agenda/bookings), :496 (.ics) | [Confirmado (pela documentação; envio fora deste repositório)] Descrito em CLAUDE.md (Infraestrutura › Agendamento da demonstração). |

### Suporte

| ID sugerido | Canal | Gatilho | Tipo de disparo | Destinatário | Remetente e marca | Assunto ou título | Texto atual | Variáveis usadas | Template | Anexos | Provedor | Condições de envio | Personalizável pelo buffet? | Registra log ou status de entrega? | Opt-out ou consentimento | Status | Arquivo:linha | Observações |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| suporte.chamado_aberto | API de saída (Manager Hwesta, helpdesk) | Abrir chamado em /suporte | Manual | Admin do Banket (helpdesk no Manager) | Dono ou equipe do buffet (nome e e-mail do usuário vão no chamado) | {assunto} digitado | {descricao} digitada + contexto: app, versão, papel, URL, user agent | {assunto}, {descricao}, {prioridade}, {categoria}, user_id, tenant_id, user_name, user_email | — | Nenhum | HTTP para HWESTA_MANAGER_URL com HWESTA_APP_KEY (timeout 10 s) | Integração configurada; senão a tela avisa que o suporte está indisponível | Não se aplica | No Manager; no Banket não | Não se aplica | Ativo | src/server/suporte.ts:89 → src/lib/hwesta/client.ts:15 (página src/pages/suporte/index.astro:17) | [Confirmado] |
| suporte.chamado_resposta_usuario | API de saída (Manager Hwesta, helpdesk) | Responder chamado em /suporte/:id | Manual | Admin do Banket | Dono ou equipe do buffet | — | {mensagem} digitada (autor = nome do usuário) | {mensagem}, {usuario} | — | Nenhum | HTTP para o Manager | Chamado do próprio usuário | Não se aplica | No Manager | Não se aplica | Ativo | src/server/suporte.ts:113 (página src/pages/suporte/[id].astro:26) | [Confirmado] |
| suporte.resposta_do_banket | In-app (notificação) | Manager envia evento de resposta do chamado (hwesta_events) | Evento | Dono ou equipe do buffet (autor do chamado) | Banket | — | — (não implementado) | — | — | — | — | — | — | O evento é gravado em hwesta_events e marcado como processado | — | Inativo | src/lib/hwesta/adapter.ts:161-166 | [Confirmado] Código só com comentário ("Quando houver notificações in-app/e-mail, disparar aqui"): o usuário só vê a resposta se abrir o chamado. |


## 3. Infraestrutura de envio

### Provedores

| Provedor | Uso | Onde | Configuração |
|---|---|---|---|
| **Resend** (API HTTP `https://api.resend.com/emails`, sem SDK) | Todo e-mail enviado pelo Banket | `src/lib/mail.ts:57-95` (`sendMail`) | `RESEND_API_KEY`, `MAIL_FROM` (definidas em produção) |
| **Resend Receiving + webhooks** | Respostas do cliente no Inbox e status de entrega | `src/pages/api/webhooks/resend.ts`, `src/server/inbox/receber.ts`, `src/lib/resendReceiving.ts` | `RESEND_INBOUND_DOMAIN`, `RESEND_WEBHOOK_SECRET` (definidas) |
| **Google Calendar API** | Convites, alterações e cancelamentos de reuniões com Meet | `src/lib/google.ts:181-235` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (definidas); por usuário, tokens cifrados em `usuario_google` |
| **Manager Hwesta** (HTTP) | Chamados de suporte (saída) e eventos do Manager (entrada) | `src/lib/hwesta/client.ts`, `src/server/suporte.ts`, `src/lib/hwesta/adapter.ts` | `HWESTA_MANAGER_URL`, `HWESTA_APP_KEY`, `HWESTA_MANAGER_KEY` (definidas) |
| WhatsApp | Só links `wa.me` abertos pelo usuário; nenhuma API | `src/pages/eventos/[id]/index.astro`, `src/pages/staff/profissionais.astro`, `src/pages/formularios/index.astro` | — |
| SMS, push, WhatsApp API, nodemailer, SES e similares | **Não encontrado** | — | — |

Sem `RESEND_API_KEY`, ou quando todos os destinatários são de domínio reservado (`example.com`, `.test`…), o e-mail só
vai para o log (`[mail:dev]`) e a função devolve `delivered: false`. Os e2e contam com isso.

### Remetentes e domínios

- Endereço único para tudo: o de `MAIL_FROM`, no domínio `banket.com.br` (padrão no código: `Banket <nao-responda@banket.com.br>`, `src/lib/mail.ts:41`).
- **E-mails do sistema** (acesso, convite, pedido recebido): nome de exibição "Banket", sem Reply-To.
- **E-mails do buffet** (proposta, contrato, Inbox): nome de exibição `"{usuário} · {empresa}"` no mesmo endereço
  (`src/lib/mail.ts:50-55`); Reply-To `r-{token}@{RESEND_INBOUND_DOMAIN}` (domínio de respostas, MX no Resend). Sem o
  domínio, o Reply-To é o e-mail pessoal do usuário e a resposta não volta ao Inbox.
- O buffet **não pode** usar domínio ou endereço próprio.

### Filas, jobs e crons

- **Nenhum.** Não há `node-cron`, BullMQ, pg-boss, `setInterval` no servidor nem job agendado do Banket. O crontab da VPS
  só tem um backup de outro projeto (03:00 diário, `/var/www/synka/obsidian`); `/etc/cron.d` só tem rotinas do sistema
  (certbot, limpeza do Docker, sysstat).
- Todo envio é **síncrono, na requisição do usuário**. A proposta e o documento geram o PDF no Chromium na mesma requisição.
- A única tarefa em segundo plano é a geração de imagens de fundo por IA (`server/imagemFundo.ts`), que não comunica nada.
- O reprocessamento do webhook não é job: o Resend reenvia o evento quando o Banket responde 500.

### Engine de templates

- Não há engine (sem MJML, Handlebars, EJS ou React Email). São duas funções de template literal com HTML em linha e cores
  em hex:
  - `emailLayout` (`src/server/emails.ts:11`): título, parágrafos, botão, link de reserva e rodapé, com a marca textual "banket". Usado pelos e-mails do sistema.
  - `mensagemHtml` (`src/server/emailTexto.ts:16`): texto do usuário em parágrafos, sem logo, com uma linha de rodapé. Usado pelos e-mails do buffet.
- Variáveis `{nome}` dos modelos de e-mail: `aplicarVariaveis` (`src/lib/documentos/variaveis.ts`), aplicada no servidor
  antes de mostrar o texto no drawer. As seis variáveis aceitas estão em `src/server/emailModelos.ts:9`.
- Textos fixos no código: os seis e-mails de acesso e convite, o aviso de pedido recebido, os rodapés "Proposta enviada
  por…", "Mensagem enviada por…", "Documento enviado por…" e o texto do compartilhamento por WhatsApp.
- Inativos no banco: `configuracoes_tenant.email_assunto` e `email_corpo` (substituídos por `email_modelos` na migration
  020; sem uso, a remover).

### Logs, status de entrega e devoluções

| O quê | Onde | Cobertura |
|---|---|---|
| Mensagens enviadas e recebidas pelo Inbox | `mensagens` (14 linhas: 8 saídas, todas "entregue"; 6 entradas) e `conversas` (4) | Só proposta, contrato, resposta e mensagem nova |
| Eventos do webhook do Resend | `resend_events` (30: 12 `email.sent`, 11 `delivered`, 6 `received`, 1 `bounced`), idempotente pelo svix-id | Todos os e-mails da conta Resend |
| Linha do tempo do evento | `evento_timeline` (`email_enviado` 10, `email_recebido` 6, `reuniao` 1) | Envios ligados a evento |
| Versão enviada | `orcamento_versoes.enviado_em/enviado_para` (4 versões enviadas) | Proposta |
| Reuniões | `reunioes` (1, com `google_event_id`) | Convites do Google (sem status de entrega) |
| E-mails de sistema | **Nenhum registro** | Acesso, convite e pedido recebido |

- Status mapeados (`src/server/inbox/receber.ts`, `mapearStatus`): `delivered` vira entregue; `bounced` e `complained`
  viram devolvida; `failed` vira falhou; `delivery_delayed` só grava o detalhe. O Inbox mostra o selo e o detalhe.
- **Devoluções sem dono**: há 4 eventos marcados como "mensagem desconhecida" (3 `delivered`, 1 `bounced`). São e-mails de
  sistema, que não guardam o `resend_id`: **pelo menos uma devolução de e-mail transacional passou sem ninguém saber.**
- Falha na API do Resend lança erro. Nos fluxos de acesso, o erro é engolido e só vai ao log. No convite e nos e-mails
  do buffet, a operação é desfeita e o usuário vê o erro. Não há nova tentativa automática.
- Ninguém é avisado de devolução ou falha. O usuário só vê o selo se abrir a conversa.

## 4. O que cada buffet pode personalizar hoje

| Item | E-mails do sistema (acesso, convite, pedido recebido) | E-mails do buffet (proposta, contrato, Inbox) | PDF da proposta / documentos | Formulário público |
|---|---|---|---|---|
| Logo | Não (marca textual "banket") | Não (o e-mail não tem logo) | Sim (template / identidade do modelo) | Sim (identidade da empresa na página) |
| Cores | Não (paleta fixa do Banket) | Não | Sim | — |
| Textos | Não (fixos no código; só o nome da empresa entra) | Sim: modelos de e-mail (nome, assunto, corpo, padrão, ativo) e edição a cada envio; rodapé fixo | Sim (blocos, textos do template, corpo do documento) | Sim: perguntas e mensagem de sucesso |
| Remetente | Não ("Banket") | Só indiretamente: nome do usuário e da empresa no nome de exibição; endereço sempre o do Banket | — | — |
| Assinatura | Não | Não há assinatura de e-mail (a do PDF vem de Configurações › Empresa: nome, cargo, telefone) | Sim | — |
| Canais | Não | Não: só e-mail (WhatsApp apenas por link manual) | — | — |
| Desligar um envio | Não (o pedido recebido sai sempre que há e-mail) | Envios são manuais | — | — |

## 5. Mapa de eventos do sistema

Legenda: **Sim** = gera comunicação hoje; **Não** = sem comunicação (candidata para as jornadas); **Manual** = só se o
usuário enviar algo por conta própria.

### Lead / pedido (formulário público ou cadastro manual)

| Transição | Comunicação hoje |
|---|---|
| Pedido recebido pelo formulário (evento criado na etapa `novo`, `origem = formulario`) | Sim: e-mail ao cliente (`vendas.pedido_recebido_cliente`) e tela de sucesso. **Não** avisa o buffet (nem e-mail nem notificação; só aparece no Kanban) |
| Evento criado manualmente | Não |
| Cliente criado (pelo formulário ou manual) | Não |
| Pedido sem resposta do buffet há N dias | Não (não existe controle) |

### Card do Kanban (`eventos.status_id` → `status_orcamento.variante`: novo → negociação → aprovado / recusado)

| Transição | Comunicação hoje |
|---|---|
| novo → negociação (automática ao criar o orçamento, ou por arrastar) | Não (só timeline) |
| qualquer → aprovado (pede a data de fechamento) | Não |
| qualquer → recusado (pede o motivo da perda) | Não |
| Saída de aprovado/recusado (reabertura) | Não |
| Anotação com retorno combinado (`retorno_em`) vence | Não (só a lista "Retornos combinados" no dashboard) |
| Orçamento parado há mais de 7 dias após o envio | Não (só a lista do dashboard) |
| Data do evento muda, convidados mudam, espaço muda | Não (só timeline) |

### Orçamento e versões (`orcamentos`, `orcamento_versoes`: aberta → congelada)

| Transição | Comunicação hoje |
|---|---|
| Orçamento criado (versão 01) | Não |
| Nova versão criada / versão restaurada | Não |
| PDF gerado | Não |
| Versão enviada (congela e abre a próxima) | Sim, manual (`proposta.envio`) |
| E-mail da proposta entregue / devolvido / falhou | Só status no Inbox; ninguém é avisado |
| Proposta perto de vencer (`validade_proposta_dias`, `orcamentos.data_vencimento`) | Não |
| Proposta vencida | Não |

### Proposta e conversa (`conversas`, `mensagens`)

| Transição | Comunicação hoje |
|---|---|
| Cliente responde o e-mail | Contador de não lidas no menu; nenhum aviso ao usuário responsável |
| Usuário responde / nova mensagem | Sim, manual (`inbox.resposta`, `inbox.mensagem_nova`) |
| Cliente não abre ou não responde | Não (não há rastreio de abertura nem lembrete) |
| Aceite da proposta pelo cliente | Não existe no sistema (aceite só por e-mail livre; o usuário move o card) |

### Contrato (`documentos`: gerado → enviado; sem status de assinatura)

| Transição | Comunicação hoje |
|---|---|
| Documento gerado | Não (só timeline `documento_gerado`) |
| Documento enviado | Sim, manual (`contrato.envio_documento`) |
| Assinado / devolvido assinado | Não existe estado nem comunicação |
| Documento excluído | Não |

### Pagamento ou parcela

Não encontrado: o sistema não tem entidade de pagamento, parcela, cobrança ou vencimento financeiro.

### Evento (realização)

| Transição | Comunicação hoje |
|---|---|
| Reunião agendada / alterada / cancelada | Sim, pelo Google Agenda (convite, atualização, cancelamento) |
| Lembrete de reunião | Inferido: lembretes padrão do Google |
| Checklist (`pendente → agendado → enviado → concluído`, com prazo) | Não (nem aviso de prazo vencendo) |
| Degustação (item de checklist / anotação) | Não |
| Véspera do evento / data do evento / pós-evento (agradecimento, pesquisa) | Não |
| Lista de compras / estoque abaixo do mínimo / insumo vencendo | Não (alertas só na tela do Assistente de Orçamentos e do Estoque) |
| Staff do evento (convocação de profissionais) | Não (só links manuais por profissional) |
| Convidados do evento | Não existe cadastro de convidados |

### Usuário (`usuarios`, `tenant_usuarios`, `auth_tokens`)

| Transição | Comunicação hoje |
|---|---|
| Cadastro (verificação pendente) | Sim (`acesso.verificacao_email`) |
| E-mail verificado / empresa criada (onboarding concluído) | Não (sem boas-vindas) |
| Convite enviado / reenviado | Sim |
| Convite aceito | Não (quem convidou não é avisado) |
| Convite expirando ou expirado | Não |
| Pedido de senha / link de acesso | Sim |
| Senha alterada (pela recuperação ou em Minha conta) | Não (sem alerta de segurança) |
| Login com o Google cria conta ou vincula conta existente | Não |
| Agenda Google revogada (`invalid_grant` desativa a agenda) | Não (só aviso na tela ao tentar agendar) |
| Papel alterado, membro desativado ou removido | Não |
| Usuário sem acesso há N dias | Não |

### Assinatura do buffet (`tenants.status`: `active`, `trial`, `past_due`, `suspended`, `canceled`; plano em `hwesta_entitlements`)

| Transição | Comunicação hoje |
|---|---|
| Empresa criada (trial ou ativa) | Não |
| Trial terminando | Não (no Banket; o Manager pode ter algo, não verificado) |
| `past_due` (pagamento em atraso) | Não |
| Suspensa / cancelada | Só a tela de bloqueio ao entrar; nenhum e-mail |
| Reativada | Não |
| Plano alterado (snapshot em `hwesta_entitlements`; 0 linhas hoje) | Não |
| Resposta do suporte (`hwesta_events`; 0 linhas hoje) | Não (gancho existe, sem envio: `adapter.ts:161`) |

## 6. Lacunas e riscos

### Opt-out e consentimento (LGPD)

1. **Nenhum envio tem descadastro** (sem link, sem cabeçalho `List-Unsubscribe`, sem tabela de preferências). Hoje quase
   tudo é transacional ou um a um, mas as jornadas futuras (follow-up, pós-evento) vão precisar disso.
2. **O formulário público não tem aceite de privacidade.** Ele coleta nome, e-mail e WhatsApp do cliente final e dispara
   e-mail sem registrar base legal nem consentimento (`src/lib/formularios/modelo.ts`, `src/server/formularios.ts`).
3. **Não está claro quem é o controlador.** O aviso de pedido recebido fala em nome do buffet, mas sai como "Banket"
   pelo domínio do Banket. O cliente final não sabe quem trata os dados.
4. **Endereços digitados livremente** (até 5 por envio, qualquer domínio) ficam guardados em `conversas.participantes` e
   `mensagens.para` sem vínculo com cliente cadastrado. Não há rotina de retenção ou exclusão das conversas, nem dos
   anexos recebidos em `mensagens/…`.
5. O único canal para o titular é o `mailto:contato@banket.com.br` em `/privacidade`.

### Envio síncrono, sem fila

6. **Todo envio é síncrono e sem nova tentativa.** Uma queda do Resend vira erro na tela (proposta, contrato, convite) ou
   some no log (acesso, pedido recebido).
7. Na proposta e no documento, o PDF é gerado no Chromium dentro da mesma requisição, com o limite de 60 s do Nginx.
8. **O e-mail sai antes de o registro ser gravado** (`conversas.ts:290` envia; o `INSERT` em `mensagens` vem depois, na
   mesma transação). Se a transação falhar depois do envio, o cliente recebe e o sistema não registra. O mesmo vale para
   o convite.
9. Não existe agendamento (cron ou fila): **nenhum lembrete, follow-up ou aviso de prazo é possível hoje** sem infraestrutura nova.

### Textos fixos no código

10. Os seis e-mails de acesso e convite e o aviso de pedido recebido são fixos e não têm a marca do buffet (o aviso ao
    cliente final leva o layout e a marca "banket").
11. Os rodapés "Proposta enviada por {empresa}.", "Mensagem enviada por {usuário}." e "Documento enviado por {usuário}."
    são fixos. Se o usuário digitar a assinatura no corpo, ela sai em dobro.
12. Os e-mails do buffet não têm logo, cor, assinatura nem dados de contato da empresa, embora a empresa já tenha logo e
    assinatura cadastrados.
13. Não há modelo de e-mail próprio para contrato: os modelos nascem com o texto da proposta ("Segue em anexo a
    proposta de orçamento…") e podem ser usados no envio do contrato.

### Ausência de log

14. **E-mails de sistema não têm registro** (verificação, senha, link de acesso, convite, pedido recebido). O `resend_id`
    é descartado. Já há 4 eventos do webhook marcados como "mensagem desconhecida", inclusive uma devolução.
15. Os contatos por `mailto:` e `wa.me` (cliente, responsável, profissionais, espaços) ficam fora do histórico do evento.
    A anotação manual do tipo WhatsApp é opcional.
16. Devoluções e falhas não geram aviso a ninguém. O status só aparece dentro da conversa.

### Mensagens duplicadas ou conflitantes

17. A proposta tem trava de 60 s para o mesmo envio. Resposta, mensagem nova e documento não têm: um duplo clique pode
    enviar duas vezes (não há trava no servidor).
18. O reenvio do convite troca o "{quem convidou}" para quem clicou em Reenviar.
19. A conversa é por usuário e evento: dois vendedores do mesmo buffet falando com o mesmo cliente criam duas conversas,
    e o cliente recebe e-mails de remetentes diferentes.

### Problemas de texto e de conteúdo

20. **O aviso de pedido recebido diz "é só responder este e-mail", mas não tem Reply-To.** A resposta vai para o
    endereço de `MAIL_FROM` (nao-responda) e não chega ao buffet nem ao Inbox.
21. A tela de sucesso do formulário afirma "Enviamos uma cópia da confirmação para o seu e-mail" sem saber se o envio
    deu certo, e o e-mail não traz cópia das respostas.
22. **`{valor_total}` vaza quando a proposta esconde o total.** `rascunhoEnvio` lê `mostrar_valor_total` (`envio.ts:49`)
    e não usa: o e-mail pode mostrar o valor que o PDF esconde.
23. O convite usa "convidado" no masculino fixo e o papel em minúsculas ("como proprietário").
24. O e-mail do convite usa o rodapé genérico "Você recebeu este e-mail porque há uma ação associada ao seu endereço no Banket."
25. O texto dos convites do Google segue o idioma da conta Google do organizador; o Banket não controla.

### Jornadas sem nenhuma comunicação (resumo da seção 5)

26. O buffet não é avisado de pedido novo nem de resposta do cliente (só o contador do menu).
27. Não há boas-vindas, onboarding, alerta de senha alterada nem aviso de convite aceito.
28. Não há follow-up de proposta, aviso de proposta vencendo, nem confirmação de aprovação ou recusa ao cliente.
29. Não há comunicação de evento (véspera, dia, pós-evento, pesquisa), de checklist, de staff ou de estoque.
30. Não há nenhuma comunicação do Banket sobre a assinatura (trial, atraso, suspensão, reativação) nem aviso de resposta do suporte.
31. Não existe módulo de pagamentos nem cadastro de convidados.

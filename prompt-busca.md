Vamos desenvolver o Banket Busca, um marketplace que conecta clientes a buffets e serviços de catering (social e corporativo), no modelo "GetNinjas para buffets". É uma extensão da marca Banket (app.banket.com.br), meu SaaS de gestão para buffets, mas é um sistema separado.

O layout já está pronto e foi exportado do Claude Design para a pasta ./layout-busca. Siga fielmente as telas, os tokens e os componentes do design system do Banket que estão lá. Não invente um estilo novo.

## Stack
- Astro em modo SSR (adapter @astrojs/node, standalone), TypeScript estrito
- PostgreSQL com Drizzle ORM e migrations versionadas
- Validação com Zod (formulários e API)
- Autenticação própria para buffets: e-mail e senha com hash argon2, sessões em cookie httpOnly guardadas no banco. Clientes finais não precisam de conta.
- Upload de imagens em disco local (./uploads), com redimensionamento via sharp; abstraia o storage para trocar por S3 depois
- Docker e docker-compose (app + postgres) para rodar na minha VPS Ubuntu, atrás de Nginx. O projeto fica em /var/www/banket-busca.
- Variáveis em .env, com um .env.example documentado

## Páginas públicas (SEO é prioridade)
1. Home/busca: buscador guiado (tipo de evento, cidade, data, número de convidados), categorias, como funciona, destaques, chamada para buffets.
2. Resultados: filtros (preço por pessoa, tipo de serviço, capacidade, domicílio ou espaço próprio, restrições alimentares, avaliação, distância), ordenação, paginação e estado vazio. Os filtros ficam na URL (query string) para serem compartilháveis e indexáveis. Seleção múltipla para pedir orçamento a vários buffets de uma vez.
3. Perfil do buffet (/buffet/[slug]): galeria, descrição, eventos atendidos, cardápios e pacotes, área de atendimento, avaliações e formulário de orçamento.
4. Pedido de orçamento: dados do evento já preenchidos a partir da busca, mais nome, e-mail, WhatsApp e observações. Mostre uma tela de confirmação.
5. Landing pages de SEO geradas por combinação: /buffet/[tipo-de-evento]/[cidade] (ex.: /buffet/casamento/campinas).
- Meta tags, Open Graph, schema.org (LocalBusiness, AggregateRating), sitemap.xml dinâmico e robots.txt.

## Área logada do buffet (/painel)
1. Cadastro, login, recuperação de senha e verificação de e-mail.
2. Onboarding em etapas, com progresso salvo a cada etapa: dados da empresa (nome, CNPJ com validação, logo, contato, descrição), tipos de evento e serviço, região de atendimento (cidades e/ou raio em km a partir de um endereço), capacidade mínima e máxima, cardápios e pacotes (preço por pessoa, restrições atendidas), fotos, disponibilidade (calendário com datas bloqueadas), revisão e publicação.
3. Dashboard com métricas: visualizações do perfil, pedidos recebidos, taxa de resposta e orçamentos fechados.
4. Pedidos de orçamento: lista com status (novo, respondido, em negociação, fechado, perdido), detalhe do pedido e resposta ao cliente.
5. Edição de perfil, cardápios, fotos e disponibilidade; avaliações recebidas; prévia do perfil público.
6. Banner "Conectar ao Banket". Por enquanto é só um placeholder; a integração vem numa fase futura.

## Regras de negócio
- Um buffet só aparece na busca depois de publicar o perfil completo.
- A busca cruza o tipo de evento, a cidade ou o raio de atendimento, a capacidade (os convidados precisam estar entre o mínimo e o máximo) e a disponibilidade na data.
- O pedido de orçamento gera um registro por buffet selecionado.
- O cliente recebe confirmação por e-mail. O buffet é notificado por e-mail e, numa fase posterior, por WhatsApp. Deixe a camada de notificação abstraída.
- Avaliações só podem ser feitas por clientes com pedido associado, via link único enviado por e-mail.
- Proteção contra spam nos formulários públicos: rate limit por IP e honeypot.
- Geolocalização: guarde latitude/longitude de cidades e endereços e use o cálculo de distância no próprio Postgres (earthdistance ou PostGIS; escolha e justifique).

## Modelagem (proposta inicial; refine)
buffets, buffet_users, sessions, event_types, service_types, buffet_event_types, buffet_service_types, service_areas, menus/packages, photos, availability_blocks, quote_requests, quote_responses, reviews, profile_views, cities.

## Como quero que você trabalhe
1. Antes de codar, leia a pasta ./layout-busca e me entregue um PLANO.md com: arquitetura de pastas, schema do banco, lista de rotas e fases de entrega. Espere minha aprovação.
2. Entregue em fases: (1) setup, banco e seed; (2) páginas públicas com dados de seed; (3) autenticação e onboarding; (4) dashboard e pedidos; (5) SEO, notificações e deploy.
3. Crie um seed com dados fictícios realistas (buffets em São Paulo, Campinas, Santo André, ABC; preços em reais).
4. Mobile-first, acessível (labels, contraste, navegação por teclado).
5. Escreva testes para a lógica de busca/matching e para os fluxos de orçamento.
6. Ao final de cada fase, rode build, lint e testes e me diga como validar.
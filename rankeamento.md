# Banket Busca: ranking dos resultados

> **Situação:** implementado em 18/10/2026 (`lib/busca/ranking.ts` + `ranking.test.ts`, migration 047). Taxa de
> resposta = cumprimento do tempo de resposta escolhido pela empresa (Configurações › Empresa), calculada a cada hora pelo
> agendador; atividade = maior entre a última atualização do perfil e o último pedido respondido. A home usa as mesmas
> regras sem as vagas marcadas. Rótulo "Destaque" com a explicação "Como ordenamos os resultados" na lista.

Objetivo: o pagante (Perfil Personalizado) ganha vantagem clara e visível, sem fazer o gratuito (Perfil Simples)
sumir da busca. O ranking atual (`lib/busca/ranking.ts`, função `ordenar`) coloca todo pagante com
`busca_prioridade` antes de qualquer gratuito (grupo rígido). Esta proposta troca o grupo rígido por um bônus
dosado, vagas de destaque e um piso de exposição para o gratuito.

## 1. Compatibilidade (eliminatória, sem mudança)

Continua em `lib/busca/matching.ts` (`compativel` + `passaFiltros`): tipo de evento, região (mesma cidade, cidades
atendidas, raio de domicílio, distância do espaço próprio), capacidade, data ocupada (só para quem tem agenda) e
os filtros escolhidos. Quem não atende o pedido não aparece, pague ou não.

## 2. Pontuação de relevância (0 a 1, igual para todos)

| Critério | Peso | Como medir |
|---|---|---|
| Distância / região | 0,30 | 1 − min(distância, raio de referência) / raio de referência; sem distância = 0,5 |
| Avaliação | 0,25 | (nota / 5) × min(1, total de avaliações / avaliações de confiança) |
| Completude do perfil | 0,20 | completude / 100 |
| Resposta | 0,15 | taxa de resposta (e, quando houver, tempo de resposta); sem dado = 0,5 |
| Atividade recente | 0,10 | perfil atualizado ou pedido respondido nos últimos 90 dias (1 → 0 ao longo do tempo) |

Os pesos continuam configuráveis por `BUSCA_RANKING_PESOS` (JSON parcial, normalizado para somar 1).
O critério "atividade recente" é novo e evita perfis abandonados no topo.

## 3. Bônus do pagante (substitui o grupo rígido)

    pontuacao_final = relevancia + bonus_pago

    bonus_pago = BONUS_PAGO × fator_qualidade × fator_distancia   (só se busca_prioridade)
      BONUS_PAGO       = 0,15 (configurável; faixa de teste 0,10 a 0,25)
      fator_qualidade  = completude / 100
      fator_distancia  = 1 dentro do raio de atendimento; cai linearmente até 0 em 2× o raio

- O pagante passa à frente de gratuitos parecidos, mas não de um gratuito muito melhor ou muito mais perto.
- O bônus só vale cheio com perfil completo: incentiva o pagante a caprichar.
- Ordenações explícitas do usuário ("Melhor avaliados", "Mais próximos") ignoram o bônus e as vagas de destaque e
  ordenam só pelo critério escolhido (empate: pontuação final).

## 4. Vagas de destaque (topo da primeira página)

- As primeiras `VAGAS_DESTAQUE = 3` posições (configurável) vão para pagantes compatíveis, por pontuação final.
- Só concorre à vaga o pagante com relevância ≥ `RELEVANCIA_MINIMA_DESTAQUE = 0,40` (sem o bônus).
- Os cards de destaque levam o rótulo "Destaque" + selo "Cliente Banket".
- Com menos pagantes elegíveis do que vagas, as vagas que sobram voltam para a lista comum.

## 5. Lista mesclada, com piso para o gratuito

- Da posição seguinte às vagas de destaque em diante: ordem pela pontuação final.
- Regra de vitrine: no máximo `MAX_PAGOS_SEGUIDOS = 3` pagantes seguidos (as vagas de destaque não contam). Ao
  atingir o limite, entra o próximo gratuito com a melhor pontuação final, se houver.
- A regra vale página a página ("Mostrar mais" de 12 em 12).

## 6. Rodízio entre empatados

- Resultados com diferença de pontuação final < `EMPATE = 0,03` são reordenados de forma pseudoaleatória com a
  semente `dia (fuso SP) + slug da cidade + tipo` (igual para todos os visitantes no mesmo dia, sem salto entre
  páginas).
- Desempate final: mais avaliações, depois nome.

## 7. Exemplo (10 resultados, Santo André)

1–3: pagantes relevantes (Destaque). 4–10: lista mesclada, por exemplo pago, grat., grat., pago, grat., pago, grat.
Um gratuito a 2 km com nota 4,9 aparece por volta da 4ª ou 5ª posição; um pagante a 30 km com perfil fraco fica atrás.

## 8. Parâmetros (`BUSCA_RANKING_PESOS` ou um novo `BUSCA_RANKING_REGRAS`)

| Parâmetro | Padrão |
|---|---|
| distancia / avaliacao / completude / resposta / atividade | 0,30 / 0,25 / 0,20 / 0,15 / 0,10 |
| bonus_pago | 0,15 |
| vagas_destaque | 3 |
| relevancia_minima_destaque | 0,40 |
| max_pagos_seguidos | 3 |
| empate | 0,03 |

## 9. Implementação

- `lib/busca/ranking.ts`: novo `fatores` (com atividade), `pontuar` + `bonusPago`, `ordenar` sem grupo rígido,
  `montarPagina` (destaques → mescla com limite de pagos seguidos → rodízio). Tudo puro e testado
  (`ranking.test.ts`).
- `server/busca/publico.ts`: trazer `updated_at` do perfil e a data do último pedido respondido (atividade); marcar
  `destaque` no item para o card.
- `components/busca/BuffetCard.astro`: rótulo "Destaque" quando o item vier marcado.
- Testes: pagante perto passa à frente de gratuito parecido; gratuito muito melhor passa à frente de pagante fraco;
  nunca mais de 3 pagantes seguidos fora do destaque; vagas de destaque exigem relevância mínima; ordenações
  explícitas ignoram o bônus; rodízio estável dentro do mesmo dia.

## 10. Como medir (semanal)

- Participação de pagantes e gratuitos nas aparições e nos cliques. Referência: pagantes com 50–60% dos cliques,
  gratuitos com pelo menos 30% das aparições.
- Taxa de clique e de pedido por posição.
- Conversão de gratuito para pago depois do aviso "buscas que você perdeu".
- Ajustar `bonus_pago` e `vagas_destaque` pelos parâmetros, sem mudar código.

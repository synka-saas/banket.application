-- Faixa de verba informada pelo cliente no formulário de captação ("Até R$ 5.000", "De R$ 10.000 a R$ 25.000"…).
-- O formulário pergunta uma faixa, não um valor: ela não cabe em verba_total (número) e ficava só no snapshot das
-- respostas. Agora vai para o evento e aparece como "Verba estimada" quando não há valor numérico.

ALTER TABLE eventos ADD COLUMN IF NOT EXISTS verba_faixa TEXT;

-- Pedidos já recebidos: copia a faixa do snapshot (rótulo da opção no momento do envio)
UPDATE eventos e
   SET verba_faixa = r.faixa
  FROM (
    SELECT DISTINCT ON (fr.evento_id) fr.evento_id, d->>'valor' AS faixa
      FROM formulario_respostas fr, jsonb_array_elements(fr.dados) d
     WHERE fr.evento_id IS NOT NULL
       AND d->>'chave' IN ('b2b_budget', 'b2c_budget')
       AND coalesce(d->>'valor', '') <> ''
     ORDER BY fr.evento_id, fr.created_at DESC
  ) r
 WHERE e.id = r.evento_id
   AND e.verba_faixa IS NULL;

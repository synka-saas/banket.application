Dashboard "Funil por etapa" rows — stage dot + label, proportional bar, count, money.

```jsx
<FunnelBreakdown stages={[
  { label: "Novo orçamento", stage: "new", count: 5, value: "R$ 0,00" },
  { label: "Em negociação", stage: "negotiation", count: 10, value: "R$ 179.205,00" },
  { label: "Aprovado", stage: "won", count: 1, value: "R$ 8.500,00" },
  { label: "Recusado", stage: "lost", count: 0, value: "R$ 0,00" },
]} />
```

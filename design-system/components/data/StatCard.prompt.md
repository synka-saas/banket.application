Dashboard KPI tile — eyebrow label, big tabular figure, context line. Lay out 5-up in a grid.

```jsx
<div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:16}}>
  <StatCard label="Pedidos recebidos" value="16" hint="últimos 90 dias" />
  <StatCard label="Em aberto" value="R$ 179.205,00" hint="15 eventos no funil" />
  <StatCard label="Aprovados" value="R$ 8.500,00" hint="1 evento" tone="success" />
  <StatCard label="Taxa de conversão" value="100%" hint="1 aprovados · 0 recusados" />
  <StatCard label="Ticket médio" value="R$ 8.500,00" hint="dos eventos aprovados" />
</div>
```

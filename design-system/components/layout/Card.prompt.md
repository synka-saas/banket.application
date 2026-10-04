The base container for dashboard widgets, settings sections and catalog items.

```jsx
<Card icon="layout-kanban" title="Funil por etapa" description="Pedidos que entraram em: últimos 90 dias">
  <FunnelBreakdown stages={…} />
</Card>

<Card icon="building" title="Dados da empresa" divided>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px 20px"}}>…fields…</div>
</Card>

<Card title="Identidade visual" collapsible divided>…</Card>
```

- Card titles are **sentence case, 15px medium** (legacy used ALL-CAPS terracotta titles — now the icon tile carries the brand color).
- Page background is `--bg-app` (clay-50); cards are white with a clay-200 hairline and `--shadow-xs`.

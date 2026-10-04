The standard list view for every Banket catalog (eventos, clientes, itens do cardápio, seções, usuários, staff…) — rounded card, sortable headers, footer with count + pagination.

```jsx
<Table
  sort={sort} onSort={setSort}
  columns={[
    { key: "data", header: "Data", sortable: true, numeric: true },
    { key: "evento", header: "Evento", sortable: true, variant: "accent" },
    { key: "cliente", header: "Cliente" },
    { key: "convidados", header: "Convidados", align: "right", numeric: true },
    { key: "etapa", header: "Etapa", render: r => <StageDot stage={r.stage} label={r.etapa} /> },
    { key: "orcamento", header: "Orçamento", align: "right", numeric: true },
    { key: "acoes", header: "", variant: "actions", render: () => <Button variant="text">Abrir</Button> },
  ]}
  rows={rows}
  footer={<><span><strong>16</strong> registros</span><Pagination page={1} pageCount={1} /></>}
/>
```

- The record's name column uses `variant: "accent"` (terracotta, medium) — it's the click target.
- Row actions are `Button variant="text"` in an `actions` column, right aligned.
- Money is right-aligned with tabular numerals: `R$ 9.200,00`. Dates `dd/mm/aaaa`.

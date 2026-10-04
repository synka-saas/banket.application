One stage column of the Funil de vendas kanban — header with stage dot, count and money total; stacked EventCards; dashed empty slot.

```jsx
<div className="bk-kanban">  {/* horizontal-scrolling board, columns min 264px */}
  <KanbanColumn title="Novo orçamento" stage="new" count={5} total="R$ 0,00">…EventCards…</KanbanColumn>
  <KanbanColumn title="Em negociação" stage="negotiation" count={9} total="R$ 171.300,00">…</KanbanColumn>
  <KanbanColumn title="Aprovado" stage="won" count={1} total="R$ 8.500,00">…</KanbanColumn>
  <KanbanColumn title="Recusado" stage="lost" count={0} total="R$ 0,00" />
</div>
```

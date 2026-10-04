Kanban card for one event in the Funil de vendas — title, client, key facts, type + time-in-stage tags, overflow menu.

```jsx
<EventCard title="Degustação" client="Maria Eduarda Silva" eventType="Social" timeInStage="há 11 dias nesta etapa"
  rows={[{label:"Pessoas",value:"50"},{label:"Formato de serviço",value:"-"},{label:"Orçamento",value:"R$ 9.250,00"},{label:"Data",value:"29/10/2026"}]}
  menuItems={[{label:"Abrir evento",icon:"external-link"},{label:"Excluir",icon:"trash",danger:true}]} />
```

- Use inside `KanbanColumn`. Before a quote exists the money row is "Verba estimada"; after, "Orçamento".

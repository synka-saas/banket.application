Mutually exclusive toggle group — view switchers (Lista / Kanban, Mês / Semana) and short settings choices (intervalo do funil, alinhamento).

```jsx
<SegmentedControl value={view} onChange={setView}
  options={[{ value: "lista", label: "Lista", icon: "list" }, { value: "kanban", label: "Kanban", icon: "layout-kanban" }]} />
<SegmentedControl variant="accent" size="lg" value="6m"
  options={[{value:"1m",label:"1 mês"},{value:"3m",label:"3 meses"},{value:"6m",label:"6 meses"},{value:"all",label:"Sem limite"}]} />
```

- `subtle` (default) for view toggles; `accent` when the choice is a saved setting.
- 2–5 options; longer lists → `Select`.

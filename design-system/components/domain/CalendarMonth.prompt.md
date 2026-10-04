Agenda month grid. Week starts Sunday; outside-month days are muted; today is a terracotta disc; events render as soft chips with a stage-colored bar.

```jsx
<CalendarMonth year={2026} month={9} today="2026-10-04"
  events={[
    { date: "2026-09-30", time: "20:00", title: "Teste de cadastro de evento", stage: "negotiation" },
    { date: "2026-10-29", time: "11:00", title: "Degustação 1 – Maria Eduarda Silva", stage: "negotiation" },
  ]}
  onEventClick={openEvent} />
```

- Pair with a toolbar: prev / Hoje / next, month title ("Outubro 2026"), status filter, `SegmentedControl` Mês | Semana.
- Footnote under the grid: "2 eventos no período. Eventos sem data definida não aparecem na agenda."

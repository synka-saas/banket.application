const { CalendarMonth, Button, IconButton, Select, SegmentedControl } = window.BanketDesignSystem_f9651f;

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function AgendaScreen({ onNavigate }) {
  const [ym, setYm] = React.useState({ y: 2026, m: 9 });
  const [mode, setMode] = React.useState("mes");
  const shift = (d) => setYm(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });
  const events = [
    { date: "2026-09-30", time: "20:00", title: "Teste de cadastro de evento", stage: "negotiation" },
    { date: "2026-10-29", time: "11:00", title: "Degustação 1 – Maria Eduarda Silva", stage: "negotiation" },
    { date: "2026-11-05", time: "12:00", title: "Degustação 2 – Maria Eduarda Silva", stage: "negotiation" },
    { date: "2026-11-12", time: "19:00", title: "Casamento – Antonio Rodrigues Neto", stage: "new" },
    { date: "2026-11-15", time: "18:30", title: "Casamento – Maria Eduarda Silva", stage: "negotiation" },
  ];
  const inMonth = events.filter((e) => e.date.startsWith(ym.y + "-" + String(ym.m + 1).padStart(2, "0"))).length;
  return (
    <AppShell page="agenda" onNavigate={onNavigate} title="Agenda">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <IconButton icon="chevron-left" label="Mês anterior" variant="secondary" size="sm" onClick={() => shift(-1)} />
          <Button variant="secondary" size="sm" onClick={() => setYm({ y: 2026, m: 9 })}>Hoje</Button>
          <IconButton icon="chevron-right" label="Próximo mês" variant="secondary" size="sm" onClick={() => shift(1)} />
        </div>
        <h2 style={{ fontSize: "var(--fs-20)", letterSpacing: "-0.01em", color: "var(--text-strong)", flex: 1 }}>{MONTHS_PT[ym.m]} {ym.y}</h2>
        <Select options={["Todos os status", "Novo orçamento", "Em negociação", "Aprovado"]} defaultValue="Todos os status" style={{ width: 200 }} />
        <SegmentedControl value={mode} onChange={setMode} options={[{ value: "mes", label: "Mês" }, { value: "semana", label: "Semana" }]} />
      </div>
      <CalendarMonth year={ym.y} month={ym.m} today="2026-10-04" events={events} />
      <p style={{ marginTop: 14, fontSize: 13, color: "var(--text-muted)" }}>{inMonth} {inMonth === 1 ? "evento" : "eventos"} no período. Eventos sem data definida não aparecem na agenda.</p>
    </AppShell>
  );
}

Object.assign(window, { AgendaScreen });

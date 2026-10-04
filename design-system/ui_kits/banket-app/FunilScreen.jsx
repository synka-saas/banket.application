const { Toolbar, TextInput, Button, SegmentedControl, KanbanColumn, EventCard, Table, StageDot, Select, Icon } = window.BanketDesignSystem_f9651f;

function eventRows(e) {
  return [
    { label: "Pessoas", value: e.pessoas },
    { label: "Formato de serviço", value: e.formato },
    e.orcamento ? { label: "Orçamento", value: e.orcamento } : { label: "Verba estimada", value: e.verba },
    { label: "Data", value: e.data },
  ];
}
const sumMoney = (list) => {
  const n = list.reduce((s, e) => s + (e.orcamento ? parseFloat(e.orcamento.replace(/[R$\s.]/g, "").replace(",", ".")) : 0), 0);
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
};

function FunilScreen({ onNavigate, onNewEvent }) {
  const D = window.BK_DATA;
  const [view, setView] = React.useState("kanban");
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState({ key: "data", dir: "desc" });
  const events = D.events.filter((e) => !q || (e.full + e.client).toLowerCase().includes(q.toLowerCase()));
  const menu = [{ label: "Abrir evento", icon: "external-link" }, { label: "Mover etapa", icon: "arrows-exchange" }, { label: "Duplicar", icon: "copy" }, { divider: true }, { label: "Excluir", icon: "trash", danger: true }];

  return (
    <AppShell page="funil" onNavigate={onNavigate} title="Funil de vendas">
      <Toolbar style={{ marginBottom: 14 }}
        start={<>
          <TextInput icon="search" placeholder="Pesquisar" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 300 }} />
          <SegmentedControl value={view} onChange={setView} options={[{ value: "lista", label: "Lista", icon: "list" }, { value: "kanban", label: "Kanban", icon: "layout-kanban" }]} />
        </>}
        end={<>
          <Button variant="secondary" icon="filter">Filtros</Button>
          <Button variant="secondary" icon="download">Exportar CSV</Button>
          <Button icon="circle-plus" onClick={onNewEvent}>Novo evento</Button>
        </>} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>
        <Icon name="calendar" size={15} stroke={1.75} />
        Intervalo de trabalho: <Select size="sm" options={["1 mês", "3 meses", "6 meses", "Sem limite"]} defaultValue="6 meses" style={{ width: 120 }} /> de hoje até 04/04/2027 (eventos sem data também aparecem)
      </div>

      {view === "kanban" ? (
        <div className="bk-kanban">
          {D.stages.map((s) => {
            const list = events.filter((e) => e.stage === s.key);
            return (
              <KanbanColumn key={s.key} title={s.label} stage={s.key} count={list.length} total={sumMoney(list)}>
                {list.map((e) => <EventCard key={e.id} title={e.title} client={e.client} kind={e.kind} eventType={e.type} timeInStage={e.dias} rows={eventRows(e)} menuItems={menu} />)}
              </KanbanColumn>
            );
          })}
        </div>
      ) : (
        <Table sort={sort} onSort={setSort} rows={events}
          columns={[
            { key: "data", header: "Data", sortable: true, numeric: true, width: 120 },
            { key: "full", header: "Evento", sortable: true, variant: "accent" },
            { key: "client", header: "Cliente", sortable: true },
            { key: "pessoas", header: "Convidados", sortable: true, align: "right", numeric: true },
            { key: "stage", header: "Etapa", sortable: true, render: (r) => <StageDot stage={r.stage} label={D.stages.find((s) => s.key === r.stage).label} /> },
            { key: "orcamento", header: "Orçamento", sortable: true, align: "right", numeric: true },
            { key: "acoes", header: "", variant: "actions", render: () => <Button variant="text">Abrir</Button> },
          ]}
          footer={<span><strong>{events.length}</strong> registros</span>} />
      )}
    </AppShell>
  );
}

Object.assign(window, { FunilScreen });

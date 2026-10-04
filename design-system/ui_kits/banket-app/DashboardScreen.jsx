const { StatCard, Card, FunnelBreakdown, AgendaItem, Select, Button, EmptyState } = window.BanketDesignSystem_f9651f;

function DashboardScreen({ onNavigate }) {
  return (
    <AppShell page="dashboard" onNavigate={onNavigate} title="Dashboard">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: "var(--fs-24)", letterSpacing: "-0.01em", color: "var(--text-strong)", marginBottom: 4 }}>Olá, Leandro</h2>
          <p style={{ color: "var(--text-secondary)" }}>Indicadores dos pedidos que entraram no período escolhido. Os valores vêm do orçamento mais recente de cada evento.</p>
        </div>
        <Select options={["Últimos 30 dias", "Últimos 90 dias", "Este ano"]} defaultValue="Últimos 90 dias" style={{ width: 200, flex: "none" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
        <StatCard label="Pedidos recebidos" value="16" hint="últimos 90 dias" />
        <StatCard label="Em aberto" value="R$ 179.205,00" hint="15 eventos no funil" />
        <StatCard label="Aprovados" value="R$ 8.500,00" hint="1 evento" tone="success" />
        <StatCard label="Taxa de conversão" value="100%" hint="1 aprovados · 0 recusados" />
        <StatCard label="Ticket médio" value="R$ 8.500,00" hint="dos eventos aprovados" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card icon="layout-kanban" title="Funil por etapa" description="Pedidos que entraram em: últimos 90 dias"
            actions={<Button variant="text" tone="accent" size="sm" iconRight="chevron-right" onClick={() => onNavigate("funil")}>Ver funil</Button>}>
            <FunnelBreakdown stages={[
              { label: "Novo orçamento", stage: "new", count: 5, value: "R$ 0,00" },
              { label: "Em negociação", stage: "negotiation", count: 10, value: "R$ 179.205,00" },
              { label: "Aprovado", stage: "won", count: 1, value: "R$ 8.500,00" },
              { label: "Recusado", stage: "lost", count: 0, value: "R$ 0,00" },
            ]} />
          </Card>
          <Card icon="send" title="Propostas sem retorno há 7+ dias" description="Situação de agora · não depende do período">
            <p style={{ color: "var(--text-secondary)" }}>Nenhuma proposta enviada aguardando retorno há mais de 7 dias.</p>
          </Card>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card icon="bell" title="Retornos combinados" description="Anotações com data de retorno · não depende do período">
            <p style={{ color: "var(--text-secondary)" }}>Nenhum retorno agendado. Registre anotações com data de retorno na linha do tempo dos eventos.</p>
          </Card>
          <Card icon="calendar" title="Próximos 30 dias" description="Eventos a partir de hoje · não depende do período">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <AgendaItem date="2026-10-29" title="Degustação 1 – Maria Eduarda Silva" meta="Quinta-feira · 11:00 · 50 convidados" stage="negotiation" stageLabel="Em negociação" onClick={() => onNavigate("agenda")} />
            </div>
            <div style={{ marginTop: 14 }}><Button variant="text" tone="accent" size="sm" iconRight="chevron-right" onClick={() => onNavigate("agenda")}>Abrir agenda</Button></div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

Object.assign(window, { DashboardScreen });

const { Button, Table, EmptyState, Drawer, Field, Select, TextInput, Textarea, StatusBadge, Toolbar } = window.BanketDesignSystem_f9651f;

function SuporteScreen({ onNavigate }) {
  const [open, setOpen] = React.useState(false);
  const [tickets, setTickets] = React.useState([]);
  const [assunto, setAssunto] = React.useState("");
  const submit = () => {
    if (!assunto.trim()) return;
    setTickets([{ id: tickets.length + 1, n: "#" + String(1024 + tickets.length), assunto, tipo: "Dúvida", data: "04/10/2026 às 14:32" }, ...tickets]);
    setAssunto(""); setOpen(false);
  };
  return (
    <AppShell page="suporte" onNavigate={onNavigate} title="Suporte">
      <Toolbar style={{ marginBottom: 20 }} start={<p className="bk-intro">Dúvidas, problemas e sugestões: abra um chamado e acompanhe a resposta da nossa equipe por aqui.</p>}
        end={<Button icon="circle-plus" onClick={() => setOpen(true)}>Novo chamado</Button>} />
      <Table rows={tickets} columns={[
        { key: "n", header: "Nº", width: 90, numeric: true, variant: "strong" },
        { key: "assunto", header: "Assunto", variant: "accent" },
        { key: "tipo", header: "Tipo" },
        { key: "s", header: "Situação", render: () => <StatusBadge status="open" /> },
        { key: "data", header: "Última atualização", numeric: true },
      ]} empty={<EmptyState icon="headset" title="Nenhum chamado aberto" description="Quando precisar de ajuda, abra um chamado: a conversa com o suporte fica registrada aqui." action={<Button icon="circle-plus" onClick={() => setOpen(true)}>Novo chamado</Button>} />} />
      <Drawer open={open} onClose={() => setOpen(false)} title="Novo chamado" actions={<Button size="sm" onClick={submit}>Abrir chamado</Button>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
          <Field label="Tipo" required><Select options={["Dúvida", "Problema", "Sugestão"]} defaultValue="Dúvida" /></Field>
          <Field label="Prioridade" required><Select options={["Baixa", "Média", "Alta"]} defaultValue="Média" /></Field>
          <Field label="Assunto" required style={{ gridColumn: "1 / -1" }}><TextInput placeholder="Ex.: Não consigo gerar o PDF da proposta" value={assunto} onChange={(e) => setAssunto(e.target.value)} /></Field>
          <Field label="O que aconteceu?" required style={{ gridColumn: "1 / -1" }}><Textarea rows={7} placeholder="Conte o que você estava fazendo, o que esperava e o que apareceu na tela." /></Field>
        </div>
      </Drawer>
    </AppShell>
  );
}

Object.assign(window, { SuporteScreen });

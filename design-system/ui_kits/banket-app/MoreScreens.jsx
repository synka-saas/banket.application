const { Toolbar, TextInput, Select, Button, Table, StatusBadge, CatalogCard, Drawer, Field, Textarea, Switch } = window.BanketDesignSystem_f9651f;

function StaffScreen({ onNavigate }) {
  const [tab, setTab] = React.useState("profissionais");
  const [open, setOpen] = React.useState(false);
  const pros = [
    ["Ana Beatriz Ferreira", "ana.ferreira@email.com", "(41) 95555-4444", "Barman", true], ["Carlos Eduardo Santos", "carlos.santos@email.com", "(41) 97777-6666", "Garçom", true],
    ["Juliana Costa", "juliana.costa@email.com", "(41) 98888-1111", "Maître", true], ["Marcos Lima", "marcos.lima@email.com", "(41) 96666-3333", "Cozinheiro", true],
    ["Patrícia Souza", "patricia.souza@email.com", "(41) 94444-5555", "Copeira", true], ["Roberto Alves", "roberto.alves@email.com", "(41) 93333-2222", "Garçom", false],
  ].map(([nome, email, tel, esp, ativo], i) => ({ id: i, nome, email, tel, esp, ativo }));
  return (
    <AppShell page="staff" onNavigate={onNavigate} breadcrumb={["Staff", tab === "profissionais" ? "Profissionais" : "Serviços e custos"]}
      tabs={[{ key: "profissionais", label: "Profissionais" }, { key: "servicos", label: "Serviços e custos" }]} activeTab={tab} onTab={setTab}>
      <Toolbar style={{ marginBottom: 20 }} start={<><TextInput icon="search" placeholder="Pesquisar" style={{ width: 300 }} /><Select placeholder="Especialidade" options={["Barman", "Garçom", "Maître", "Cozinheiro", "Copeira"]} style={{ width: 220 }} /></>}
        end={<Button icon="circle-plus" onClick={() => setOpen(true)}>Novo profissional</Button>} />
      <Table rows={pros} columns={[
        { key: "nome", header: "Nome", sortable: true, render: (r) => <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--text-strong)", fontWeight: 500 }}>{r.nome}{!r.ativo ? <StatusBadge status="inactive" /> : null}</span> },
        { key: "c", header: "Contato", render: (r) => <div style={{ lineHeight: 1.45 }}><a href={"mailto:" + r.email}>{r.email}</a><div style={{ fontSize: 13, color: "var(--text-muted)" }}>{r.tel} · <a href="#" onClick={(e) => e.preventDefault()}>chamar no WhatsApp</a></div></div> },
        { key: "esp", header: "Especialidade", sortable: true },
        { key: "a", header: "", variant: "actions", render: () => <Button variant="text">Editar</Button> },
      ]} footer={<span><strong>{pros.length}</strong> registros</span>} />
      <Drawer open={open} onClose={() => setOpen(false)} title="Novo profissional" actions={<Button size="sm" onClick={() => setOpen(false)}>Salvar</Button>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
          <Field label="Nome" required style={{ gridColumn: "1 / -1" }}><TextInput placeholder="Nome completo" /></Field>
          <Field label="E-mail"><TextInput type="email" placeholder="nome@email.com" /></Field>
          <Field label="Telefone / WhatsApp"><TextInput placeholder="(00) 00000-0000" /></Field>
          <Field label="Especialidade"><Select placeholder="Selecione…" options={["Barman", "Garçom", "Maître", "Cozinheiro", "Copeira"]} /></Field>
          <Field label="CPF"><TextInput placeholder="000.000.000-00" /></Field>
          <Field label="Chave Pix" style={{ gridColumn: "1 / -1" }}><TextInput /></Field>
          <Field label="Observações" style={{ gridColumn: "1 / -1" }}><Textarea rows={4} /></Field>
          <div style={{ gridColumn: "1 / -1" }}><Switch label="Profissional ativo" defaultChecked /></div>
        </div>
      </Drawer>
    </AppShell>
  );
}

function TemplateCover({ title, bg }) {
  return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: bg, color: "#6E8B3D", fontSize: 15, fontWeight: 500, letterSpacing: ".06em", textAlign: "center", padding: 16, textTransform: "uppercase" }}>{title}</div>;
}

function TemplatesScreen({ onNavigate }) {
  const [tab, setTab] = React.useState("templates");
  return (
    <AppShell page="templates" onNavigate={onNavigate} title="Templates" tabs={[{ key: "templates", label: "Templates" }, { key: "blocos", label: "Blocos de informação" }]} activeTab={tab} onTab={setTab}>
      <Toolbar style={{ marginBottom: 20 }} start={<TextInput icon="search" placeholder="Pesquisar" style={{ width: 300 }} />} end={<Button icon="circle-plus">Novo template</Button>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, maxWidth: 1000 }}>
        <CatalogCard icon="soup" title="Template padrão" description="Estilo dos cardápios de referência: capa com título, páginas creme e títulos em vermelho." tags={["Padrão", "Clássico"]}
          status={<StatusBadge tone="accent" dot={false}>Padrão</StatusBadge>} media={<TemplateCover title="Proposta de orçamento" bg="#F8FAF0" />} />
        <CatalogCard icon="soup" title="Proposta Casamentos Premium" description="Criado pelo teste" media={<TemplateCover title="Proposta comercial" bg="var(--clay-100)" />} />
      </div>
    </AppShell>
  );
}

Object.assign(window, { StaffScreen, TemplatesScreen });

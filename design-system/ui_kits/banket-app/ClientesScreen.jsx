const { Toolbar, TextInput, Select, Button, Table, Pagination, Drawer, Field, Textarea } = window.BanketDesignSystem_f9651f;

function ClientDrawer({ open, onClose, onSave }) {
  const [tipo, setTipo] = React.useState("Pessoa física");
  const [nome, setNome] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const save = () => { setTouched(true); if (nome.trim()) { onSave({ nome }); setNome(""); setTouched(false); } };
  return (
    <Drawer open={open} onClose={onClose} title="Novo cliente" actions={<Button size="sm" onClick={save}>Salvar</Button>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
        <Field label="Tipo"><Select options={["Pessoa física", "Pessoa jurídica"]} value={tipo} onChange={(e) => setTipo(e.target.value)} /></Field>
        <Field label={tipo === "Pessoa física" ? "CPF" : "CNPJ"}><TextInput placeholder={tipo === "Pessoa física" ? "000.000.000-00" : "00.000.000/0000-00"} /></Field>
        <Field label="Nome / razão social" required style={{ gridColumn: "1 / -1" }} error={touched && !nome.trim() ? "Informe o nome do cliente." : null}>
          <TextInput placeholder="Ex.: Maria Silva, TechCorp Brasil" value={nome} invalid={touched && !nome.trim()} onChange={(e) => setNome(e.target.value)} autoFocus />
        </Field>
        <Field label="E-mail"><TextInput type="email" placeholder="nome@email.com" /></Field>
        <Field label="Telefone / WhatsApp"><TextInput type="tel" placeholder="(00) 00000-0000" /></Field>
        <Field label="Endereço" style={{ gridColumn: "1 / -1" }}><TextInput placeholder="Rua, número, bairro, cidade - UF" /></Field>
        <Field label="Observações" style={{ gridColumn: "1 / -1" }}><Textarea rows={4} /></Field>
      </div>
    </Drawer>
  );
}

function ClientesScreen({ onNavigate }) {
  const [clients, setClients] = React.useState(window.BK_DATA.clients);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState({ key: "nome", dir: "asc" });
  const rows = clients.filter((c) => !q || (c.nome + c.email).toLowerCase().includes(q.toLowerCase()))
    .slice().sort((a, b) => (sort.dir === "asc" ? 1 : -1) * String(a[sort.key]).localeCompare(String(b[sort.key]), "pt-BR", { numeric: true }));
  return (
    <AppShell page="clientes" onNavigate={onNavigate} title="Clientes">
      <Toolbar style={{ marginBottom: 20 }}
        start={<>
          <TextInput icon="search" placeholder="Pesquisar por nome, e-mail ou documento" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 340 }} />
          <Select placeholder="Tipo de cliente" options={["Pessoa física", "Pessoa jurídica"]} style={{ width: 220 }} />
        </>}
        end={<>
          <Button variant="secondary" icon="file-import">Importar CSV</Button>
          <Button icon="circle-plus" onClick={() => setOpen(true)}>Novo cliente</Button>
        </>} />
      <Table rows={rows} sort={sort} onSort={setSort} columns={[
        { key: "nome", header: "Nome", sortable: true, variant: "accent" },
        { key: "doc", header: "CPF / CNPJ", numeric: true },
        { key: "contato", header: "Contato", render: (r) => <div style={{ lineHeight: 1.45 }}><div>{r.email}</div><div style={{ color: "var(--text-muted)", fontSize: 13 }}>{r.tel}</div></div> },
        { key: "eventos", header: "Eventos", sortable: true, align: "right", numeric: true },
        { key: "a", header: "", variant: "actions", render: () => <Button variant="text">Editar</Button> },
      ]} footer={<><span><strong>{rows.length}</strong> de {rows.length} registros</span><Pagination page={1} pageCount={1} pageSize={20} /></>} />
      <ClientDrawer open={open} onClose={() => setOpen(false)} onSave={(c) => { setClients([{ id: Date.now(), nome: c.nome, doc: "-", email: "-", tel: "", eventos: 0 }, ...clients]); setOpen(false); }} />
    </AppShell>
  );
}

Object.assign(window, { ClientesScreen });

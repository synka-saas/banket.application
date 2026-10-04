const { Toolbar, TextInput, Select, Button, Table, StatusBadge, StageDot, ReorderControls, Card, SegmentedControl, Field, FileField, Textarea, VariableChip, Switch } = window.BanketDesignSystem_f9651f;

const CONFIG_TABS = [
  { key: "usuarios", label: "Usuários" }, { key: "tipos", label: "Tipos de evento" }, { key: "ocasioes", label: "Ocasiões" },
  { key: "etapas", label: "Etapas do funil" }, { key: "formatos", label: "Formatos de serviço" }, { key: "locacao", label: "Locação" }, { key: "empresa", label: "Empresa" },
];

function EtapasTab() {
  const D = window.BK_DATA;
  const [range, setRange] = React.useState("6m");
  const counts = { new: 5, negotiation: 10, won: 1, lost: 0 };
  return (
    <>
      <Toolbar style={{ marginBottom: 16 }} start={<p className="bk-intro">Cada etapa é uma coluna do <strong>Funil de vendas</strong>, na ordem abaixo. A função define como a etapa entra nas métricas: novos pedidos caem na primeira etapa de <em>entrada</em>.</p>} end={<Button icon="circle-plus">Nova etapa</Button>} />
      <Table rows={D.stages.map((s) => ({ ...s, id: s.key }))} columns={[
        { key: "ord", header: "", width: 96, render: (r, i) => <ReorderControls canUp={i > 0} canDown={i < 3} /> },
        { key: "label", header: "Nome", render: (r) => <StageDot stage={r.key} label={r.label} /> },
        { key: "fn", header: "Função", className: "bk-cell-muted" },
        { key: "n", header: "Eventos", align: "right", numeric: true, render: (r) => counts[r.key] },
        { key: "a", header: "", variant: "actions", render: () => <Button variant="text">Editar</Button> },
      ]} />
      <Card icon="calendar" title="Intervalo de trabalho do funil" description="O Funil de vendas mostra os eventos de hoje até o fim do intervalo escolhido. Eventos ainda sem data sempre aparecem." style={{ marginTop: 20, maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <SegmentedControl variant="accent" size="lg" value={range} onChange={setRange} options={[{ value: "1m", label: "1 mês" }, { value: "3m", label: "3 meses" }, { value: "6m", label: "6 meses" }, { value: "all", label: "Sem limite" }]} />
          <Button>Salvar intervalo</Button>
        </div>
      </Card>
    </>
  );
}

function EmpresaTab() {
  const g2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" };
  const g3 = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px 20px" };
  return (
    <div style={{ maxWidth: 960, display: "flex", flexDirection: "column", gap: 20 }}>
      <Card icon="building" title="Dados da empresa" divided>
        <div style={g2}>
          <Field label="Nome fantasia" required><TextInput defaultValue="Banket" /></Field>
          <Field label="Razão social"><TextInput /></Field>
          <Field label="Tipo"><Select options={["Pessoa física", "Pessoa jurídica"]} defaultValue="Pessoa física" /></Field>
          <Field label="CPF"><TextInput defaultValue="081.536.916-60" /></Field>
          <Field label="E-mail"><TextInput defaultValue="contato@banket.com.br" /></Field>
          <Field label="Telefone / WhatsApp"><TextInput defaultValue="(11) 94460-7049" /></Field>
          <Field label="Endereço" style={{ gridColumn: "1 / -1" }}><TextInput defaultValue="Rua Loureiro da Cruz, 35 — Ponto de referência: Esquina da Pires da Mota" /></Field>
          <Field label="Logotipo" hint="Usado nos templates de orçamento." style={{ gridColumn: "1 / -1" }}><FileField name="Logotipo atual" /></Field>
        </div>
      </Card>
      <Card icon="coin" title="Parâmetros comerciais" divided>
        <div style={g3}>
          <Field label="Validade da proposta" required><TextInput type="number" defaultValue={7} addonEnd="dias" /></Field>
          <Field label="Criança não paga até" required><TextInput type="number" defaultValue={6} addonEnd="anos" /></Field>
          <Field label="Criança paga meia até" required><TextInput type="number" defaultValue={12} addonEnd="anos" /></Field>
          <Field label="Local padrão dos eventos" style={{ gridColumn: "1 / -1" }}><TextInput defaultValue="Casa Club Gourmet" /></Field>
        </div>
      </Card>
      <Card icon="mail" title="E-mail de envio do orçamento" divided>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Assunto" required><TextInput defaultValue="Proposta de orçamento - {evento}" /></Field>
          <Field label="Mensagem" required><Textarea rows={6} defaultValue={"Olá {nome_cliente},\n\nAgradecemos o interesse em realizar o seu evento conosco! Segue em anexo a proposta de orçamento para {evento}, no dia {data_evento}.\n\nQualquer dúvida, estamos à disposição.\n\n{empresa}"} /></Field>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: -6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 4 }}>Clique para inserir no campo:</span>
            {["{nome_cliente}", "{evento}", "{data_evento}", "{empresa}", "{valor_total}", "{versao}"].map((v) => <VariableChip key={v}>{v}</VariableChip>)}
          </div>
        </div>
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Button>Salvar</Button></div>
    </div>
  );
}

function ConfiguracoesScreen({ onNavigate }) {
  const D = window.BK_DATA;
  const [tab, setTab] = React.useState("etapas");
  const label = { usuarios: "Usuários", tipos: "Tipos de evento", ocasioes: "Ocasiões", etapas: "Etapas do funil", formatos: "Formatos de serviço", locacao: "Locação do espaço", empresa: "Empresa" }[tab];
  let body = null;
  if (tab === "etapas") body = <EtapasTab />;
  else if (tab === "empresa") body = <EmpresaTab />;
  else if (tab === "usuarios") body = (<>
    <Toolbar style={{ marginBottom: 20 }} start={<><TextInput icon="search" placeholder="Pesquisar" style={{ width: 300 }} /><Select placeholder="Papel" options={["Proprietário", "Usuário"]} style={{ width: 200 }} /></>} end={<Button icon="user-plus">Convidar usuário</Button>} />
    <Table rows={D.users} columns={[
      { key: "nome", header: "Nome", variant: "strong" }, { key: "email", header: "E-mail" }, { key: "papel", header: "Papel" },
      { key: "st", header: "Status", render: () => <StatusBadge status="active" /> },
      { key: "a", header: "", variant: "actions", render: (r) => (r.self ? null : <Button variant="text">Editar</Button>) },
    ]} footer={<span><strong>{D.users.length}</strong> registros</span>} />
  </>);
  else if (tab === "ocasioes") body = (
    <Table rows={[["Aniversário", [0, 0, 1], 2], ["Casamento", [0, 0, 1], 3], ["Confraternização de fim de ano", [1, 0, 0], 2], ["Degustação", [1, 0, 1], 4], ["Festa de 15 Anos", [0, 0, 1], 1]].map(([n, t, e], i) => ({ id: i, n, t, e }))} columns={[
      { key: "n", header: "Ocasião", variant: "strong" },
      { key: "t", header: "Tipos de evento", render: (r) => <div style={{ display: "flex", gap: 20 }}>{["Corporativo", "Religioso", "Social"].map((l, j) => <Switch key={l} size="sm" label={l} defaultChecked={!!r.t[j]} />)}</div> },
      { key: "e", header: "Eventos", align: "right", numeric: true },
      { key: "a", header: "", variant: "actions", render: () => <><Button variant="text">Editar</Button><Button variant="text" tone="danger">Excluir</Button></> },
    ]} />);
  else body = (
    <Table rows={(tab === "locacao" ? [["Até 30 convidados", "R$ 1.000,00", "-"], ["De 31 a 50 convidados", "R$ 1.500,00", "-"], ["De 51 a 80 convidados", "R$ 2.000,00", "-"], ["De 81 a 110 convidados", "R$ 2.500,00", "Somente na modalidade coquetel"]]
      : tab === "formatos" ? [["Serviço volante", "Garçons servindo os convidados, ideal para pessoas em pé", ""], ["Buffet", "Mesa de buffet em que o convidado se serve", ""], ["Ilhas gastronômicas", "Estações temáticas distribuídas pelo espaço", ""], ["Empratado", "Pratos montados e servidos à mesa", ""], ["Coquetel", "Finger foods e bebidas em formato de recepção", ""]]
      : [["Corporativo", "Confraternizações, lançamentos, convenções e eventos de empresas", "2"], ["Religioso", "Almoços ou jantares de batizado, primeira comunhão e encontros de paróquias.", "0"], ["Social", "Casamentos, aniversários, formaturas e celebrações em geral", "10"]]).map(([a, b, c], i) => ({ id: i, a, b, c }))}
      columns={[{ key: "a", header: tab === "locacao" ? "Faixa de convidados" : "Nome", variant: "strong" }, { key: "b", header: tab === "locacao" ? "Valor da locação" : "Descrição", numeric: tab === "locacao" }, ...(tab === "formatos" ? [] : [{ key: "c", header: tab === "locacao" ? "Observação" : "Eventos", align: tab === "locacao" ? "left" : "right", numeric: true }]), { key: "x", header: "", variant: "actions", render: () => <Button variant="text">Editar</Button> }]} />);

  return (
    <AppShell page="configuracoes" onNavigate={onNavigate} breadcrumb={["Configurações", label]} tabs={CONFIG_TABS} activeTab={tab} onTab={setTab}>
      {body}
    </AppShell>
  );
}

Object.assign(window, { ConfiguracoesScreen });

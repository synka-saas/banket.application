const { Toolbar, TextInput, Select, Button, Table, Pagination, CatalogCard, Tag, ReorderControls } = window.BanketDesignSystem_f9651f;

const CARD_TABS = [
  { key: "secoes", label: "Seções" },
  { key: "itens", label: "Itens do cardápio" },
  { key: "opcoes", label: "Opções de cardápio" },
  { key: "categorias", label: "Categorias" },
];

function CardapiosScreen({ onNavigate }) {
  const D = window.BK_DATA;
  const [tab, setTab] = React.useState("opcoes");
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(20);
  const label = CARD_TABS.find((t) => t.key === tab).label;
  const newLabel = { secoes: "Nova seção", itens: "Novo item", opcoes: "Nova opção de cardápio", categorias: "Nova categoria" }[tab];

  return (
    <AppShell page="cardapios" onNavigate={onNavigate} breadcrumb={["Cardápios", label]} tabs={CARD_TABS} activeTab={tab} onTab={setTab}>
      <Toolbar style={{ marginBottom: 20 }}
        start={<>
          <TextInput icon="search" placeholder="Pesquisar" style={{ width: 300 }} />
          {tab === "itens" || tab === "opcoes" ? <Select placeholder="Seção" options={D.sections.map((s) => s.nome)} style={{ width: 220 }} /> : null}
          {tab === "itens" ? <Select options={["Ativos e inativos", "Ativos", "Inativos"]} defaultValue="Ativos e inativos" style={{ width: 200 }} /> : null}
          {tab === "categorias" ? <Select placeholder="Principal ou secundária" options={["Principal (tipo)", "Secundária (momento)"]} style={{ width: 240 }} /> : null}
        </>}
        end={<>
          {tab === "itens" ? <Button variant="secondary" icon="file-import">Importar CSV</Button> : null}
          <Button icon="circle-plus">{newLabel}</Button>
        </>} />

      {tab === "opcoes" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {D.menuOptions.map((o) => (
            <CatalogCard key={o.id} icon="salad" title={o.title} tags={o.tags}
              rows={[{ label: "Preço por pessoa", value: o.preco }, { label: "Duração", value: o.duracao }, { label: "Seções", value: o.secoes }, { label: "Itens", value: o.itens }]} />
          ))}
        </div>
      ) : null}

      {tab === "itens" ? (
        <Table rows={D.menuItems} columns={[
          { key: "nome", header: "Nome", sortable: true, variant: "strong" },
          { key: "desc", header: "Descrição", className: "bk-cell-muted", render: (r) => r.desc === "-" ? null : <span style={{ color: "var(--text-secondary)" }}>{r.desc}</span> },
          { key: "secao", header: "Seção", sortable: true },
          { key: "preco", header: "Preço", sortable: true, align: "right", numeric: true },
          { key: "cat", header: "Categoria", render: (r) => <Select size="sm" options={["Salgado", "Doce", "Bebida"]} defaultValue={r.cat} style={{ width: 140 }} /> },
          { key: "a", header: "", variant: "actions", render: () => <Button variant="text">Editar</Button> },
        ]} footer={<><span><strong>1–20</strong> de 175 registros</span><Pagination page={page} pageCount={9} onPageChange={setPage} pageSize={size} onPageSizeChange={setSize} /></>} />
      ) : null}

      {tab === "secoes" ? (
        <Table rows={D.sections} columns={[
          { key: "ord", header: "", width: 96, render: (r, i) => <ReorderControls canUp={i > 0} canDown={i < D.sections.length - 1} /> },
          { key: "nome", header: "Seção", variant: "strong" },
          { key: "desc", header: "Descrição" },
          { key: "preco", header: "Preço", align: "right" },
          { key: "itens", header: "Itens vinculados", align: "right", numeric: true, render: (r) => <a href="#" onClick={(e) => e.preventDefault()} style={{ fontWeight: 500 }}>{r.itens}</a> },
          { key: "opcoes", header: "Em opções", align: "right", numeric: true },
          { key: "a", header: "", variant: "actions", render: () => <Button variant="text">Editar</Button> },
        ]} footer={<><span><strong>1–20</strong> de 26 registros</span><Pagination page={1} pageCount={2} pageSize={20} /></>} />
      ) : null}

      {tab === "categorias" ? (
        <>
          <Table rows={D.categories} columns={[
            { key: "nome", header: "Categoria", render: (r) => <Tag tone={r.aplica.startsWith("Principal") ? "accent" : "neutral"}>{r.nome}</Tag> },
            { key: "aplica", header: "Aplica-se a", className: "bk-cell-muted" },
            { key: "a", header: "", variant: "actions", render: () => <><Button variant="text">Editar</Button><Button variant="text" tone="danger">Excluir</Button></> },
          ]} />
          <p className="bk-intro" style={{ marginTop: 16 }}>A <strong>categoria principal</strong> indica o tipo do item (Salgado, Doce, Bebida). A <strong>secundária</strong> indica o momento do serviço (Recepção, Entrada, Prato principal, Sobremesa). Itens com categoria principal "Bebida" aparecem na aba Bebidas do orçamento.</p>
        </>
      ) : null}
    </AppShell>
  );
}

Object.assign(window, { CardapiosScreen });

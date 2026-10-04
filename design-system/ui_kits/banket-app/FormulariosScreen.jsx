const { Toolbar, TextInput, Button, CatalogCard, StatusBadge, CopyField, Card, Field, Textarea, Switch, FormSection, ActionBar, BackLink } = window.BanketDesignSystem_f9651f;

const FORM_SECTIONS = [
  { title: "Olá! Vamos criar algo inesquecível?", description: "Para começarmos a desenhar sua experiência, por favor, nos conte um pouco sobre você.", alwaysActive: true,
    questions: [{ label: "Nome / Responsável", type: "Texto curto", required: true, locked: true }, { label: "E-mail", type: "E-mail", required: true, locked: true }, { label: "WhatsApp", type: "Telefone", required: true, locked: true }, { label: "Qual o tipo do evento?", type: "Escolha única · 2 opções", required: true, locked: true }] },
  { title: "Onde será o evento?", description: "Precisamos entender o espaço para garantir a melhor logística da nossa cozinha central.",
    questions: [{ label: "Local do evento", type: "Escolha única · 2 opções", required: true }, { label: "Como é a infraestrutura do local?", type: "Escolha única · 2 opções · Aparece quando \"Local do evento\" = Local externo", required: true }, { label: "Região / CEP", type: "Texto curto" }] },
  { title: "Dimensionamento", badge: "Somente B2B", description: "Detalhes para formatarmos a proposta ideal para o seu perfil.",
    questions: [{ label: "Razão social / Empresa", type: "Texto curto", required: true }, { label: "Data prevista", type: "Data", required: true }, { label: "Quantidade de participantes", type: "Número", required: true }, { label: "Processo de aprovação", type: "Texto curto" }] },
  { title: "Gastronomia & Experiência", description: "O sabor é a alma do evento. Como deseja servir seus convidados?",
    questions: [{ label: "Formato do serviço", type: "Escolha única · 3 opções", required: true }, { label: "Bebidas e bar", type: "Escolha única · 3 opções", required: true }, { label: "Gostaria de agendar uma degustação?", type: "Escolha única · 3 opções" }] },
];

function FormEditor({ onBack }) {
  const [sections, setSections] = React.useState(FORM_SECTIONS.map((s) => ({ ...s, active: true })));
  const [dirty, setDirty] = React.useState(false);
  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ marginBottom: 16 }}><BackLink onClick={onBack}>Todos os formulários</BackLink></div>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr auto", gap: "16px 20px", alignItems: "end" }}>
          <Field label="Nome do formulário" required><TextInput defaultValue="Formulário de contato" onChange={() => setDirty(true)} /></Field>
          <Field label="Endereço público" required><TextInput prefix="/f/" defaultValue="contato-6b4f89" onChange={() => setDirty(true)} /></Field>
          <Field label="Status"><div style={{ height: 40, display: "flex", alignItems: "center" }}><Switch label="Recebendo respostas" defaultChecked /></div></Field>
          <Field label="Descrição interna" style={{ gridColumn: "1 / -1" }}><TextInput defaultValue="Triagem inicial de pedidos de orçamento (corporativo e social)." /></Field>
          <Field label="Mensagem após o envio" style={{ gridColumn: "1 / -1" }}><Textarea rows={2} defaultValue="Seu pedido foi recebido. Nossa equipe vai analisar e entrar em contato em breve." /></Field>
          <div style={{ gridColumn: "1 / -1" }}><CopyField url="https://app.banket.com.br/f/contato-6b4f89" /></div>
        </div>
      </Card>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>{sections.filter((s) => s.active).length} de {sections.length} seções ativas · As seções de dimensionamento B2B e B2C aparecem conforme a natureza escolhida pelo cliente.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
        {sections.map((s, i) => (
          <FormSection key={i} index={i + 1} {...s}
            onToggleActive={(a) => { setDirty(true); setSections(sections.map((x, j) => (j === i ? { ...x, active: a } : x))); }}
            onQuestionChange={() => setDirty(true)} />
        ))}
      </div>
      <ActionBar dirty={dirty} status={dirty ? "Alterações não salvas" : "Tudo salvo"}>
        <Button variant="secondary" size="sm" icon="eye">Pré-visualizar</Button>
        <Button variant="secondary" size="sm">Respostas</Button>
        <Button variant="secondary" size="sm" icon="copy">Duplicar</Button>
        <Button variant="danger" size="sm">Excluir</Button>
        <Button size="sm" onClick={() => setDirty(false)}>Salvar</Button>
      </ActionBar>
    </div>
  );
}

function FormulariosScreen({ onNavigate }) {
  const [editing, setEditing] = React.useState(false);
  const forms = [
    { title: "Formulário de contato", desc: "Triagem inicial de pedidos de orçamento (corporativo e social).", resp: "02", last: "23/09/2026", slug: "contato-6b4f89" },
    { title: "Novo formulário", desc: "Sem descrição.", resp: "00", last: "-", slug: "novo-a19c02" },
  ];
  return (
    <AppShell page="formularios" onNavigate={onNavigate} breadcrumb={editing ? [{ label: "Formulários", onClick: () => setEditing(false) }, "Formulário de contato"] : null} title="Formulários">
      {editing ? <FormEditor onBack={() => setEditing(false)} /> : (
        <>
          <Toolbar style={{ marginBottom: 20 }} start={<TextInput icon="search" placeholder="Pesquisar por nome ou endereço" style={{ width: 340 }} />}
            end={<Button icon="circle-plus">Novo formulário</Button>} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, maxWidth: 1100 }}>
            {forms.map((f) => (
              <CatalogCard key={f.slug} icon="stack-2" title={f.title} description={f.desc} status={<StatusBadge status="active" />}
                rows={[{ label: "Seções ativas", value: "06" }, { label: "Perguntas ativas", value: "25" }, { label: "Respostas", value: f.resp }, { label: "Última resposta", value: f.last }]}
                onAction={() => setEditing(true)}
                links={[{ label: "Respostas" }, { label: "Pré-visualizar", icon: "eye" }, { label: "Abrir formulário", icon: "external-link" }]}>
                <CopyField url={"https://app.banket.com.br/f/" + f.slug} onShare={() => {}} />
              </CatalogCard>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

Object.assign(window, { FormulariosScreen });

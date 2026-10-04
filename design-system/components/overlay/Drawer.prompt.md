Right-side drawer for create/edit forms — the Banket pattern for "Novo cliente", "Novo profissional", "Novo chamado".

```jsx
<Drawer open={open} onClose={close} title="Novo cliente" actions={<Button size="sm">Salvar</Button>}>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px 20px"}}>
    <Field label="Tipo"><Select options={["Pessoa física","Pessoa jurídica"]} /></Field>
    <Field label="CPF"><TextInput placeholder="000.000.000-00" /></Field>
    <Field label="Nome / razão social" required style={{gridColumn:"1 / -1"}}><TextInput placeholder="Ex.: Maria Silva, TechCorp Brasil" /></Field>
  </div>
</Drawer>
```

- Scrim is a warm translucent ink (`--bg-overlay`) with a 2px blur. Panel slides in 280ms ease-out.
- Primary action in the header, right before the close X. Destructive actions go in `footer`, left-aligned.

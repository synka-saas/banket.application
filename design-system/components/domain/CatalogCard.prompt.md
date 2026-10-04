Grid card for catalog entities — Opções de cardápio, Formulários, Templates. Lay out in `repeat(auto-fill,minmax(260px,1fr))`.

```jsx
<CatalogCard icon="salad" title="Buffet – Opção 01"
  rows={[{label:"Preço por pessoa",value:"R$ 80,00"},{label:"Duração",value:"-"},{label:"Seções",value:"08"},{label:"Itens",value:"31"}]}
  tags={["Buffet"]} onAction={edit} />

<CatalogCard icon="stack-2" title="Formulário de contato" description="Triagem inicial de pedidos de orçamento."
  status={<StatusBadge status="active" />}
  rows={[{label:"Seções ativas",value:"06"},{label:"Respostas",value:"02"}]}
  links={[{label:"Respostas"},{label:"Pré-visualizar",icon:"eye"},{label:"Abrir formulário",icon:"external-link"}]}>
  <CopyField url="https://app.banket.com.br/f/contato-6b4f89" />
</CatalogCard>
```

- The "Editar" action defaults to `secondary`; reserve primary for the page's "Nova …" button.

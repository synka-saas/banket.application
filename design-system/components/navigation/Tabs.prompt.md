Underline sub-navigation directly under the AppHeader — Cardápios (Seções · Itens do cardápio · Opções de cardápio · Categorias), Configurações, Staff, Templates.

```jsx
<Tabs activeKey={tab} onChange={setTab} items={[
  { key: "secoes", label: "Seções" },
  { key: "itens", label: "Itens do cardápio", count: 175 },
  { key: "opcoes", label: "Opções de cardápio" },
  { key: "categorias", label: "Categorias" },
]} />
```

- Active: terracotta-700 medium + 2px terracotta-500 underline.

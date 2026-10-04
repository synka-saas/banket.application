Dropdown action menu attached to a trigger — kanban card "⋯", row overflow, user menu. Closes on outside click / Esc.

```jsx
<Menu trigger={<IconButton icon="dots" label="Mais ações" size="sm" />} items={[
  { label: "Abrir evento", icon: "external-link" },
  { label: "Mover etapa", icon: "arrows-exchange" },
  { label: "Duplicar", icon: "copy" },
  { divider: true },
  { label: "Excluir", icon: "trash", danger: true },
]} />
```

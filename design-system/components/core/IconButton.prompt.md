Square icon-only button — close drawers, card overflow menus, calendar prev/next, reorder up/down.

```jsx
<IconButton icon="x" label="Fechar" />
<IconButton icon="dots" label="Mais ações" size="sm" />
<IconButton icon="chevron-left" label="Mês anterior" variant="secondary" size="sm" />
<IconButton icon="chevron-up" label="Mover para cima" size="xs" disabled />
```

- Always pass `label` (pt-BR verb phrase).
- `variant="secondary"` when the button sits on a page background and needs an edge.

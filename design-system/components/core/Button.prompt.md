The Banket button — use `primary` for the single main action of a region (Novo evento, Salvar), `secondary` for supporting actions, `text` for inline row actions.

```jsx
<Button icon="circle-plus">Novo evento</Button>
<Button variant="secondary" icon="download">Exportar CSV</Button>
<Button variant="secondary" icon="filter">Filtros</Button>
<Button variant="text">Editar</Button>
<Button variant="danger" icon="trash">Excluir</Button>
<Button variant="primary" size="sm">Salvar</Button>
```

- Labels are **sentence case** (the legacy UI used ALL CAPS — retired in the refresh).
- `variant="soft"` = tinted terracotta for secondary-but-branded actions (e.g. "Sugerir fontes com IA").
- `variant="text" tone="accent"` for in-card links (Respostas, Pré-visualizar).
- Max one primary per toolbar / drawer header / card.

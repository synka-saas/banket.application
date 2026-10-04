Friendly empty state — icon tile, title, one-line explanation of what will appear and how, optional CTA.

```jsx
<EmptyState icon="headset" title="Nenhum chamado aberto"
  description="Quando precisar de ajuda, abra um chamado: a conversa com o suporte fica registrada aqui."
  action={<Button icon="circle-plus">Novo chamado</Button>} />
<EmptyState compact icon="calendar" title="Nenhum evento" />
```

- Copy pattern: **"Nenhum {coisa}"** + what to do next. Never blame the user.

On/off toggle for settings that take effect immediately — "Recebendo respostas", "Seção ativa", "Profissional ativo", "Incluir capa na proposta".

```jsx
<Switch label="Recebendo respostas" defaultChecked />
<Switch label="Seção ativa" size="sm" defaultChecked />
<Switch label="Profissional ativo" checked={on} onChange={e => setOn(e.target.checked)} />
```

- Off state is a soft clay track (legacy used a black outline — replaced). On = terracotta-500.

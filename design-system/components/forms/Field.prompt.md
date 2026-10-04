Label + control + hint/error wrapper for every form input in Banket (drawers, Configurações/Empresa, form builder).

```jsx
<Field label="Nome / razão social" required hint="Como aparece na proposta.">
  <TextInput placeholder="Ex.: Maria Silva, TechCorp Brasil" />
</Field>
<Field label="E-mail" error="Informe um e-mail válido.">
  <TextInput type="email" invalid defaultValue="maria@" />
</Field>
```

- Labels are **sentence case**, 13px medium (legacy UI used ALL CAPS labels — retired).
- Lay out fields in a CSS grid with `gap: 16px 20px`; 2 columns in drawers, 3 in wide settings cards.

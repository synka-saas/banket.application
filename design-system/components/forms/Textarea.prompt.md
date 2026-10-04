Multi-line text field — Observações, e-mail message templates, form "Mensagem após o envio".

```jsx
<Field label="Observações"><Textarea rows={4} /></Field>
<Field label="Mensagem" required hint="Use {nome_cliente}, {evento}…">
  <Textarea rows={6} defaultValue={"Olá {nome_cliente},\n\nAgradecemos o interesse…"} />
</Field>
```

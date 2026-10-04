Single-line text input — search bars, form fields, money/number inputs. Supports `type="date"`, `"email"`, `"tel"`, `"number"`.

```jsx
<TextInput icon="search" placeholder="Pesquisar" />
<TextInput prefix="/f/" defaultValue="contato-6b4f89" />
<TextInput prefix="R$" defaultValue="250,00" />
<TextInput type="number" addonEnd="dias" defaultValue={7} />
<TextInput type="date" />
```

- Wrap in `Field` for a label. Search inputs in toolbars stand alone with `icon="search"` and a `width` of ~320px.
- Placeholders are examples, not labels: "Ex.: Maria Silva", "(00) 00000-0000", "nome@email.com".

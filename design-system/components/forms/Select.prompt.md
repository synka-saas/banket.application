Native dropdown with Banket styling — form choices (Tipo, Especialidade, Prioridade) and toolbar filters (Seção, Papel, Todos os status).

```jsx
<Select options={["Pessoa física", "Pessoa jurídica"]} defaultValue="Pessoa física" />
<Select placeholder="Selecione…" options={["Barman", "Garçom", "Maître", "Cozinheiro", "Copeira"]} />
<Select placeholder="Tipo de cliente" options={["Pessoa física","Pessoa jurídica"]} style={{width:240}} />
```

- Chevron always on the **right** (legacy filters had it on the left — inconsistent, fixed).
- In toolbars, filter selects sit right after the search input, ~240px wide.

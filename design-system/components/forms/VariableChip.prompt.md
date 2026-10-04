Monospace merge-tag chip that inserts a template variable into the focused field — e-mail subject/message editors.

```jsx
<div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
  <span style={{fontSize:12,color:"var(--text-muted)"}}>Clique para inserir:</span>
  {["{nome_cliente}","{evento}","{data_evento}","{empresa}","{valor_total}","{versao}"].map(v => <VariableChip key={v}>{v}</VariableChip>)}
</div>
```

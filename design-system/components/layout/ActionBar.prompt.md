Floating save bar at the bottom of long editors (form builder, template editor) — save status left, actions right.

```jsx
<ActionBar status="Tudo salvo">
  <Button variant="secondary" icon="eye">Pré-visualizar</Button>
  <Button variant="secondary">Duplicar</Button>
  <Button variant="danger">Excluir</Button>
  <Button>Salvar</Button>
</ActionBar>
<ActionBar dirty status="Alterações não salvas"><Button>Salvar</Button></ActionBar>
```

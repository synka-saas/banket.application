Grip + up/down buttons for ordered lists — Seções do cardápio, Etapas do funil, perguntas do formulário.

```jsx
<ReorderControls canUp={i > 0} canDown={i < rows.length - 1} onUp={() => move(i, -1)} onDown={() => move(i, 1)} />
```

- First row disables "up", last row disables "down".

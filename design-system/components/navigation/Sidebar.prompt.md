The Banket app sidebar — logo + the 10 product sections. Width `--sidebar-width` (248px), full height, `--bg-sidebar` warm tint.

```jsx
<div style={{display:"flex",height:"100vh"}}>
  <Sidebar activeKey="funil" onSelect={setPage} />
  <main style={{flex:1}}>…</main>
</div>
```

- Default items come from `BANKET_NAV`: Dashboard, Funil de vendas, Cardápios, Clientes, Agenda, Formulários, Staff, Templates, Configurações, Suporte (icons are the production Tabler set).
- Active item: white tile, terracotta-700 label, terracotta-600 icon. Hover: 6% terracotta wash.

The list-page toolbar above every table/grid: search + filters on the left, actions on the right (primary last).

```jsx
<Toolbar
  start={<><TextInput icon="search" placeholder="Pesquisar" style={{width:320}} />
          <Select placeholder="Seção" options={secoes} style={{width:220}} /></>}
  end={<><Button variant="secondary" icon="file-import">Importar CSV</Button>
         <Button icon="circle-plus">Novo item</Button></>} />
```

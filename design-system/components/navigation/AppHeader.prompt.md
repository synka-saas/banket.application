The 64px white top bar of every app page — page title or breadcrumb on the left, user menu on the right.

```jsx
<AppHeader title="Dashboard" user={<UserMenu name="Leandro" role="Proprietário" />} />
<AppHeader breadcrumb={[{label:"Cardápios", onClick: goBack}, "Categorias"]} user={<UserMenu name="Leandro" role="Proprietário" />} />
```

- Breadcrumb parents are muted regular; the current page is ink medium. Separator is a light "/".
- Sub-sections go in `Tabs` directly under the header.

One numbered section of the public-form builder (Formulários › editar): header with number tile, title, audience badge and "Seção ativa" switch; question rows with reorder, Obrigatória checkbox and enable switch; "Adicionar pergunta".

```jsx
<FormSection index={1} title="Olá! Vamos criar algo inesquecível?" alwaysActive
  description="Para começarmos a desenhar sua experiência, nos conte um pouco sobre você."
  questions={[{label:"Nome / Responsável",type:"Texto curto",required:true,locked:true},{label:"E-mail",type:"E-mail",required:true,locked:true}]} />
<FormSection index={3} title="Dimensionamento" badge="Somente B2B"
  questions={[{label:"Razão social / Empresa",type:"Texto curto",required:true},{label:"Processo de aprovação",type:"Texto curto"}]} />
```

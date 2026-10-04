Uploaded-asset row with thumbnail and Trocar / Remover actions — company logo, template background images. Empty state = dashed drop zone.

```jsx
<Field label="Logotipo" hint="Usado nos templates de orçamento.">
  <FileField name="Logotipo atual" thumbnail="logo.png" onReplace={…} onRemove={…} />
</Field>
<FileField onUpload={…} emptyLabel="Enviar imagem de fundo" />
```

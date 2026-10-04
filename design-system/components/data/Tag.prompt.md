Small soft-tile label for categories and metadata — event type (Social, Corporativo), menu-option tags (Buffet, Brunch, Premium), template tags, "há 11 dias nesta etapa".

```jsx
<Tag>Buffet</Tag>
<Tag tone="cobalt">Corporativo</Tag>
<Tag tone="accent" icon="clock">há 11 dias nesta etapa</Tag>
<Tag caps size="sm">Somente B2B</Tag>
```

- Sentence case by default (legacy tags were all caps).
- For status (Ativo/Inativo) use `StatusBadge`, not Tag.

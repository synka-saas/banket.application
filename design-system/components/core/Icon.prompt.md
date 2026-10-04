Tabler outline icon rendered inline (inherits `currentColor`) — use for every glyph in Banket UI; never emoji or unicode symbols.

```jsx
<Icon name="layout-dashboard" size={20} />
<Icon name="circle-plus" size={16} stroke={1.75} />
<Icon name="building" color="var(--terracotta-600)" />
```

- `size`: 16 (buttons, inline), 18 (default), 20 (sidebar nav), 24–28 (empty states).
- `stroke`: default 1.5 to match General Sans' lighter weights; 1.75 for 14–16px.
- Full list in `ICON_NAMES` (83 icons copied from Tabler Icons v3.19). Add new ones to `iconPaths.js` from the same set.

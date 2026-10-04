import React from "react";
import { Icon } from "../core/Icon.jsx";

export function Card({ title, icon, description, actions, footer, children, variant = "outlined", padding = "md", divided = false, collapsible = false, defaultOpen = true, interactive = false, onClick, className = "", style }) {
  const h = React.createElement;
  const [open, setOpen] = React.useState(defaultOpen);
  const showBody = !collapsible || open;
  const cls = ["bk-card", variant !== "outlined" ? "bk-card--" + variant : "", padding !== "md" ? "bk-card--pad-" + padding : "", interactive ? "bk-card--interactive" : "", className].filter(Boolean).join(" ");
  const hasHead = title || icon || actions;
  return h("section", { className: cls, style, onClick },
    hasHead ? h("header", { className: ["bk-card__head", divided && showBody ? "bk-card__head--divided" : "", collapsible ? "bk-card__head--toggle" : "", !showBody ? "" : ""].filter(Boolean).join(" "), onClick: collapsible ? () => setOpen(!open) : undefined, style: !showBody ? { paddingBottom: "var(--space-5)" } : undefined },
      icon ? h("span", { className: "bk-card__icon" }, h(Icon, { name: icon, size: 18 })) : null,
      h("div", { className: "bk-card__titles" },
        title ? h("h3", { className: "bk-card__title" }, title) : null,
        description ? h("div", { className: "bk-card__desc" }, description) : null),
      actions || collapsible ? h("div", { className: "bk-card__actions", onClick: (e) => actions && e.stopPropagation() }, actions,
        collapsible ? h(Icon, { name: "chevron-down", size: 18, className: "bk-card__chev" + (open ? " bk-card__chev--open" : "") }) : null) : null) : null,
    showBody && children != null ? h("div", { className: "bk-card__body" }, children) : null,
    showBody && footer ? h("footer", { className: "bk-card__foot" }, footer) : null);
}

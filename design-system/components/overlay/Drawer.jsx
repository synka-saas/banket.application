import React from "react";
import { IconButton } from "../core/IconButton.jsx";

export function Drawer({ open = true, title, subtitle, onClose, actions, footer, children, width, contained = false, className = "", style }) {
  const h = React.createElement;
  React.useEffect(() => {
    if (!open || !onClose) return;
    const k = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return h("div", { className: ["bk-drawer", contained ? "bk-drawer--contained" : "", className].filter(Boolean).join(" "), style, role: "dialog", "aria-modal": true, "aria-label": typeof title === "string" ? title : undefined },
    h("div", { className: "bk-drawer__scrim", onClick: onClose }),
    h("div", { className: "bk-drawer__panel", style: width ? { width: "min(" + (typeof width === "number" ? width + "px" : width) + ",100%)" } : undefined },
      h("div", { className: "bk-drawer__head" },
        h("div", { className: "bk-drawer__titles" },
          h("h2", { className: "bk-drawer__title" }, title),
          subtitle ? h("div", { className: "bk-drawer__sub" }, subtitle) : null),
        actions ? h("div", { className: "bk-drawer__actions" }, actions) : null,
        onClose ? h(IconButton, { icon: "x", label: "Fechar", onClick: onClose }) : null),
      h("div", { className: "bk-drawer__body" }, children),
      footer ? h("div", { className: "bk-drawer__foot" }, footer) : null));
}

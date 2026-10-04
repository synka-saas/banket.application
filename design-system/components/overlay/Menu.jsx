import React from "react";
import { Icon } from "../core/Icon.jsx";

export function Menu({ trigger, items = [], align = "end", defaultOpen = false, className = "", style }) {
  const h = React.createElement;
  const [open, setOpen] = React.useState(defaultOpen);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const trig = React.isValidElement(trigger)
    ? React.cloneElement(trigger, { onClick: (e) => { e.stopPropagation(); setOpen((o) => !o); if (trigger.props.onClick) trigger.props.onClick(e); }, "aria-expanded": open, "aria-haspopup": "menu" })
    : trigger;
  return h("div", { ref, className: ("bk-menu " + className).trim(), style },
    trig,
    open ? h("div", { className: "bk-menu__pop bk-menu__pop--" + align, role: "menu", onClick: (e) => e.stopPropagation() },
      items.map((it, i) => it.divider
        ? h("div", { key: i, className: "bk-menu__divider", role: "separator" })
        : it.section
          ? h("div", { key: i, className: "bk-menu__label" }, it.section)
          : h("button", { key: i, type: "button", role: "menuitem", disabled: it.disabled, className: "bk-menu__item" + (it.danger ? " bk-menu__item--danger" : ""),
              onClick: () => { setOpen(false); if (it.onClick) it.onClick(); } },
              it.icon ? h(Icon, { name: it.icon, size: 16, stroke: 1.75 }) : null, it.label,
              it.hint ? h("span", { className: "bk-menu__hint" }, it.hint) : null))) : null);
}

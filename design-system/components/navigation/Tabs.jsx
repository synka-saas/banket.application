import React from "react";

export function Tabs({ items = [], activeKey, onChange, inline = false, className = "", style }) {
  const h = React.createElement;
  return h("div", { className: ["bk-tabs", inline ? "bk-tabs--inline" : "", className].filter(Boolean).join(" "), role: "tablist", style },
    items.map((it) => {
      const t = typeof it === "string" ? { key: it, label: it } : it;
      return h("button", { key: t.key, type: "button", role: "tab", className: "bk-tab", "aria-selected": t.key === activeKey, onClick: () => onChange && onChange(t.key) },
        t.label, t.count != null ? h("span", { className: "bk-tab__count" }, t.count) : null);
    }));
}

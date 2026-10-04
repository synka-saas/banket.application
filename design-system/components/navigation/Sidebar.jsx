import React from "react";
import { Icon } from "../core/Icon.jsx";
import { Logo } from "../core/Logo.jsx";

export const BANKET_NAV = [
  { key: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { key: "funil", label: "Funil de vendas", icon: "layout-kanban" },
  { key: "cardapios", label: "Cardápios", icon: "tools-kitchen-2" },
  { key: "clientes", label: "Clientes", icon: "user-square" },
  { key: "agenda", label: "Agenda", icon: "calendar" },
  { key: "formularios", label: "Formulários", icon: "stack-2" },
  { key: "staff", label: "Staff", icon: "users" },
  { key: "templates", label: "Templates", icon: "file-text" },
  { key: "configuracoes", label: "Configurações", icon: "settings" },
  { key: "suporte", label: "Suporte", icon: "headset" },
];

export function Sidebar({ items = BANKET_NAV, activeKey, onSelect, brand, footer, className = "", style }) {
  const h = React.createElement;
  return h("aside", { className: ("bk-sidebar " + className).trim(), style },
    h("div", { className: "bk-sidebar__brand" }, brand || h(Logo, { height: 30 })),
    h("nav", { className: "bk-sidebar__nav", "aria-label": "Navegação principal" },
      items.map((it, i) => it.group
        ? h("div", { key: "g" + i, className: "bk-sidebar__group" }, it.group)
        : h(it.href ? "a" : "button", {
            key: it.key, type: it.href ? undefined : "button", href: it.href, className: "bk-sidebar__item",
            "aria-current": it.key === activeKey ? "page" : undefined,
            onClick: (e) => { if (onSelect) { if (it.href) e.preventDefault(); onSelect(it.key); } },
          },
            h(Icon, { name: it.icon, size: 20 }),
            h("span", { className: "bk-sidebar__label" }, it.label),
            it.count != null ? h("span", { className: "bk-sidebar__count" }, it.count) : null))),
    footer ? h("div", { className: "bk-sidebar__foot" }, footer) : null);
}

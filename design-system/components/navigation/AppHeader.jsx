import React from "react";

export function AppHeader({ title, breadcrumb, actions, user, className = "", style }) {
  const h = React.createElement;
  let titleNode = title;
  if (breadcrumb && breadcrumb.length) {
    titleNode = breadcrumb.flatMap((b, i) => {
      const last = i === breadcrumb.length - 1;
      const item = typeof b === "string" ? { label: b } : b;
      const node = last
        ? h("span", { key: "c" + i, className: "bk-crumb--current" }, item.label)
        : h("button", { key: "c" + i, type: "button", className: "bk-crumb", onClick: item.onClick }, item.label);
      return last ? [node] : [node, h("span", { key: "s" + i, className: "bk-crumb__sep", "aria-hidden": true }, "/")];
    });
  }
  return h("header", { className: ("bk-header " + className).trim(), style },
    h("h1", { className: "bk-header__title" }, titleNode),
    actions || user ? h("div", { className: "bk-header__actions" }, actions, user) : null);
}

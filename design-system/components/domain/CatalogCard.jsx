import React from "react";
import { Icon } from "../core/Icon.jsx";
import { Button } from "../core/Button.jsx";
import { InfoList } from "../data/InfoList.jsx";
import { Tag } from "../data/Tag.jsx";

export function CatalogCard({ icon = "salad", title, description, media, rows = [], tags = [], status, actionLabel = "Editar", actionVariant = "secondary", onAction, links = [], children, className = "", style }) {
  const h = React.createElement;
  return h("article", { className: ("bk-ccard " + className).trim(), style },
    h("div", { className: "bk-ccard__head" },
      h("span", { className: "bk-ccard__icon" }, h(Icon, { name: icon, size: 20 })),
      h("div", { className: "bk-ccard__titles" },
        h("h3", { className: "bk-ccard__title" }, title),
        description ? h("div", { className: "bk-ccard__desc" }, description) : null),
      status ? h("div", { style: { flex: "none" } }, status) : null),
    media ? h("div", { className: "bk-ccard__media" }, typeof media === "string" ? h("img", { src: media, alt: "" }) : media) : null,
    rows.length ? h(InfoList, { items: rows, size: "sm" }) : null,
    children,
    tags.length ? h("div", { className: "bk-ccard__tags" }, tags.map((t) => h(Tag, { key: t }, t))) : null,
    h("div", { className: "bk-ccard__foot" },
      onAction || actionLabel ? h(Button, { variant: actionVariant, block: true, onClick: onAction }, actionLabel) : null,
      links.length ? h("div", { className: "bk-ccard__links" }, links.map((l) => h(Button, { key: l.label, variant: "text", tone: "accent", size: "sm", icon: l.icon, onClick: l.onClick }, l.label))) : null));
}

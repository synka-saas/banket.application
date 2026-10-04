import React from "react";
import { Icon } from "../core/Icon.jsx";

export function StatCard({ label, value, hint, tone = "default", icon, className = "", style }) {
  const h = React.createElement;
  return h("div", { className: ["bk-stat", tone !== "default" ? "bk-stat--" + tone : "", className].filter(Boolean).join(" "), style },
    h("div", { className: "bk-stat__label bk-eyebrow" }, icon ? h(Icon, { name: icon, size: 14, stroke: 1.75 }) : null, label),
    h("div", { className: "bk-stat__value", title: typeof value === "string" ? value : undefined }, value),
    hint ? h("div", { className: "bk-stat__hint" }, hint) : null);
}

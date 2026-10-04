import React from "react";
import { Icon } from "../core/Icon.jsx";

export function EmptyState({ icon = "info-circle", title, description, action, compact = false, className = "", style }) {
  const h = React.createElement;
  return h("div", { className: ["bk-empty", compact ? "bk-empty--compact" : "", className].filter(Boolean).join(" "), style },
    h("div", { className: "bk-empty__icon" }, h(Icon, { name: icon, size: compact ? 20 : 26 })),
    title ? h("h3", { className: "bk-empty__title" }, title) : null,
    description ? h("p", { className: "bk-empty__desc" }, description) : null,
    action ? h("div", { className: "bk-empty__action" }, action) : null);
}

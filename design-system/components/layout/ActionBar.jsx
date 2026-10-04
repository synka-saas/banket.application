import React from "react";
import { Icon } from "../core/Icon.jsx";

export function ActionBar({ status = "Tudo salvo", dirty = false, sticky = true, children, className = "", style }) {
  const h = React.createElement;
  return h("div", { className: ["bk-actionbar", sticky ? "bk-actionbar--sticky" : "", className].filter(Boolean).join(" "), style },
    h("div", { className: "bk-actionbar__status" + (dirty ? " bk-actionbar__status--dirty" : "") },
      h(Icon, { name: dirty ? "alert-circle" : "circle-check", size: 15, stroke: 1.75, color: dirty ? undefined : "var(--success)" }), status),
    h("div", { className: "bk-actionbar__actions" }, children));
}

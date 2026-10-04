import React from "react";

export function InfoList({ items = [], size = "md", className = "", style }) {
  const h = React.createElement;
  return h("dl", { className: ["bk-info", size === "sm" ? "bk-info--sm" : "", className].filter(Boolean).join(" "), style },
    items.map((it, i) => {
      const empty = it.value === null || it.value === undefined || it.value === "" || it.value === "-";
      return h("div", { key: it.label + i, className: "bk-info__row" },
        h("dt", { className: "bk-info__label" }, it.label),
        h("dd", { className: "bk-info__value" + (empty ? " bk-info__value--empty" : ""), title: typeof it.value === "string" ? it.value : undefined }, empty ? "—" : it.value));
    }));
}

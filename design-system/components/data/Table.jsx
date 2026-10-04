import React from "react";
import { Icon } from "../core/Icon.jsx";

export function Table({ columns = [], rows = [], rowKey = "id", sort, onSort, onRowClick, footer, empty, dense = false, className = "", style }) {
  const h = React.createElement;
  const key = (r, i) => (typeof rowKey === "function" ? rowKey(r, i) : r[rowKey] != null ? r[rowKey] : i);
  const cellCls = (c) => [c.align ? "bk-align-" + c.align : "", c.variant ? "bk-cell-" + c.variant : "", c.numeric ? "bk-cell-num" : "", c.className || ""].filter(Boolean).join(" ") || undefined;
  const head = columns.map((c) => {
    const active = sort && sort.key === c.key;
    const label = c.sortable
      ? h("button", { type: "button", className: "bk-table__sort" + (active ? " bk-table__sort--active" : ""), onClick: () => onSort && onSort({ key: c.key, dir: active && sort.dir === "asc" ? "desc" : "asc" }) },
          c.header, h(Icon, { name: active ? (sort.dir === "asc" ? "chevron-up" : "chevron-down") : "selector", size: 14, stroke: 1.75 }))
      : c.header;
    return h("th", { key: c.key, className: c.align ? "bk-align-" + c.align : undefined, style: c.width ? { width: c.width } : undefined }, label);
  });
  const body = rows.length
    ? rows.map((r, i) => h("tr", { key: key(r, i), onClick: onRowClick ? () => onRowClick(r) : undefined },
        columns.map((c) => {
          let v = c.render ? c.render(r, i) : r[c.key];
          if (v === null || v === undefined || v === "" || v === "-") v = h("span", { className: "bk-dash" }, "—");
          return h("td", { key: c.key, className: cellCls(c) }, v);
        })))
    : [h("tr", { key: "empty" }, h("td", { className: "bk-table__empty", colSpan: columns.length }, empty || "Nenhum registro encontrado."))];
  return h("div", { className: ("bk-table-wrap " + className).trim(), style },
    h("div", { className: "bk-table-scroll" },
      h("table", { className: ["bk-table", dense ? "bk-table--dense" : "", onRowClick ? "bk-table--clickable" : ""].filter(Boolean).join(" ") },
        h("thead", null, h("tr", null, head)), h("tbody", null, body))),
    footer ? h("div", { className: "bk-table-foot" }, footer) : null);
}

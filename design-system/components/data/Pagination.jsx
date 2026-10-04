import React from "react";
import { IconButton } from "../core/IconButton.jsx";

function pageList(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out = [1];
  const start = Math.max(2, page - 1), end = Math.min(count - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < count - 1) out.push("…");
  out.push(count);
  return out;
}

export function Pagination({ page = 1, pageCount = 1, onPageChange, pageSize, pageSizes = [20, 50, 100], onPageSizeChange, className = "" }) {
  const h = React.createElement;
  const go = (p) => onPageChange && p >= 1 && p <= pageCount && onPageChange(p);
  return h("nav", { className: ("bk-pager " + className).trim(), "aria-label": "Paginação" },
    h("div", { className: "bk-pager__pages" },
      h(IconButton, { icon: "chevron-left", label: "Página anterior", size: "sm", variant: "secondary", disabled: page <= 1, onClick: () => go(page - 1) }),
      pageList(page, pageCount).map((p, i) => p === "…"
        ? h("span", { key: "g" + i, className: "bk-pager__gap" }, "…")
        : h("button", { key: p, type: "button", className: "bk-pager__page", "aria-current": p === page ? "page" : undefined, onClick: () => go(p) }, p)),
      h(IconButton, { icon: "chevron-right", label: "Próxima página", size: "sm", variant: "secondary", disabled: page >= pageCount, onClick: () => go(page + 1) })),
    pageSize ? h("div", { className: "bk-pager__size" }, "Por página:",
      pageSizes.map((s) => h("button", { key: s, type: "button", "aria-pressed": s === pageSize, onClick: () => onPageSizeChange && onPageSizeChange(s) }, s))) : null);
}

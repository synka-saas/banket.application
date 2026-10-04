import React from "react";

export function Toolbar({ start, end, children, className = "", style }) {
  const h = React.createElement;
  return h("div", { className: ("bk-toolbar " + className).trim(), style },
    h("div", { className: "bk-toolbar__start" }, start || children),
    end ? h("div", { className: "bk-toolbar__end" }, end) : null);
}

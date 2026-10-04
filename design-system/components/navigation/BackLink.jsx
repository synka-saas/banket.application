import React from "react";
import { Icon } from "../core/Icon.jsx";

export function BackLink({ children, href, onClick, className = "", style }) {
  const h = React.createElement;
  return h(href ? "a" : "button", { type: href ? undefined : "button", href, onClick, className: ("bk-back " + className).trim(), style },
    h(Icon, { name: "arrow-left", size: 16, stroke: 1.75 }), children);
}

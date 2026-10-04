import React from "react";
import { Icon } from "./Icon.jsx";

export function Button({ variant = "primary", size = "md", tone, icon, iconRight, block = false, type = "button", as, href, className = "", children, ...rest }) {
  const cls = ["bk-btn", "bk-btn--" + variant, "bk-btn--" + size, block ? "bk-btn--block" : "", tone ? "bk-btn--tone-" + tone : "", className].filter(Boolean).join(" ");
  const iconSize = size === "sm" ? 15 : size === "lg" ? 18 : 16;
  const content = [
    icon ? React.createElement(Icon, { key: "i", name: icon, size: iconSize, stroke: 1.75 }) : null,
    children != null ? React.createElement("span", { key: "c" }, children) : null,
    iconRight ? React.createElement(Icon, { key: "r", name: iconRight, size: iconSize, stroke: 1.75 }) : null,
  ];
  const Tag = as || (href ? "a" : "button");
  const props = Tag === "button" ? { type, ...rest } : { href, ...rest };
  return React.createElement(Tag, { className: cls, ...props }, content);
}

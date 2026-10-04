import React from "react";
import { Icon } from "./Icon.jsx";

export function IconButton({ icon, label, variant = "ghost", size = "md", type = "button", className = "", iconSize, ...rest }) {
  const cls = ["bk-iconbtn", variant !== "ghost" ? "bk-iconbtn--" + variant : "", size !== "md" ? "bk-iconbtn--" + size : "", className].filter(Boolean).join(" ");
  const s = iconSize || (size === "xs" ? 14 : size === "sm" ? 16 : 18);
  return React.createElement("button", { type, className: cls, "aria-label": label, title: label, ...rest },
    React.createElement(Icon, { name: icon, size: s, stroke: s <= 16 ? 1.75 : 1.5 }));
}

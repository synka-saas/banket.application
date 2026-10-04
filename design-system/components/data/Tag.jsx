import React from "react";
import { Icon } from "../core/Icon.jsx";

export function Tag({ children, tone = "neutral", caps = false, outline = false, size = "md", icon, className = "", style, ...rest }) {
  const cls = ["bk-tag", tone !== "neutral" ? "bk-tag--" + tone : "", caps ? "bk-tag--caps" : "", outline ? "bk-tag--outline" : "", size === "sm" ? "bk-tag--sm" : "", className].filter(Boolean).join(" ");
  return React.createElement("span", { className: cls, style, ...rest },
    icon ? React.createElement(Icon, { name: icon, size: 12, stroke: 1.75 }) : null, children);
}

import React from "react";
import { Icon } from "./Icon.jsx";

export function SegmentedControl({ options = [], value, onChange, variant = "subtle", size = "md", block = false, className = "", ...rest }) {
  const cls = ["bk-seg", variant === "accent" ? "bk-seg--accent" : "", size === "lg" ? "bk-seg--lg" : "", block ? "bk-seg--block" : "", className].filter(Boolean).join(" ");
  return React.createElement("div", { className: cls, role: "group", ...rest },
    options.map((o) => {
      const opt = typeof o === "string" ? { value: o, label: o } : o;
      return React.createElement("button", {
        key: opt.value, type: "button", className: "bk-seg__opt", "aria-pressed": opt.value === value,
        onClick: () => onChange && onChange(opt.value),
      }, opt.icon ? React.createElement(Icon, { name: opt.icon, size: 16, stroke: 1.75 }) : null, opt.label);
    }));
}

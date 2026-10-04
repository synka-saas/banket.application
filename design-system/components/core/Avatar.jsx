import React from "react";

export function Avatar({ name = "", src, size = "md", shape = "rounded", className = "", style }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase() || "?";
  const cls = ["bk-avatar", size !== "md" ? "bk-avatar--" + size : "", shape === "circle" ? "bk-avatar--circle" : "", className].filter(Boolean).join(" ");
  return React.createElement("span", { className: cls, style, title: name },
    src ? React.createElement("img", { src, alt: name }) : (size === "sm" ? initials[0] : initials.slice(0, size === "lg" ? 2 : 1)));
}

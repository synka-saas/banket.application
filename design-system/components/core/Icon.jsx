import React from "react";
import { ICON_PATHS } from "./iconPaths.js";

/** Tabler outline icon, rendered inline so it inherits currentColor. */
export function Icon({ name, size = 18, stroke = 1.5, color, className = "", style, title, ...rest }) {
  const inner = ICON_PATHS[name];
  if (!inner && typeof console !== "undefined") console.warn("[Banket Icon] unknown icon:", name);
  return React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color || "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: ("bk-icon " + className).trim(),
    style,
    role: title ? "img" : undefined,
    "aria-hidden": title ? undefined : true,
    "aria-label": title,
    dangerouslySetInnerHTML: { __html: inner || "" },
    ...rest,
  });
}

export const ICON_NAMES = Object.keys(ICON_PATHS);

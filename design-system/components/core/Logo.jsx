import React from "react";

function dsBase() {
  if (typeof document === "undefined") return "";
  const s = document.querySelector('script[src*="_ds_bundle.js"]');
  if (s) return s.src.replace(/_ds_bundle\.js.*$/, "");
  const c = document.querySelector('link[rel="stylesheet"][href$="styles.css"]');
  return c ? c.href.replace(/styles\.css$/, "") : "";
}

const FILES = { full: { dark: "assets/logo-dark.png", light: "assets/logo-light.png", ratio: 1194 / 315 }, mark: { dark: "assets/logo-mark.png", light: "assets/logo-mark.png", ratio: 302 / 315 } };

export function Logo({ variant = "full", tone = "dark", height = 32, src, className = "", style, ...rest }) {
  const f = FILES[variant] || FILES.full;
  const url = src || dsBase() + f[tone === "light" ? "light" : "dark"];
  return React.createElement("img", {
    src: url, alt: "banket", height, width: Math.round(height * f.ratio),
    className: ("bk-logo " + className).trim(), style: { height, width: "auto", ...style }, draggable: false, ...rest,
  });
}

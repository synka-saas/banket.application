import React from "react";

export function ProgressBar({ value = 0, max = 100, color = "var(--terracotta-500)", size = "md", label, className = "", style }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const cls = ["bk-progress", size !== "md" ? "bk-progress--" + size : "", className].filter(Boolean).join(" ");
  return React.createElement("div", { className: cls, style, role: "progressbar", "aria-valuenow": value, "aria-valuemax": max, "aria-label": label },
    React.createElement("div", { className: "bk-progress__fill", style: { width: pct + "%", background: color } }));
}

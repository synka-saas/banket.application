import React from "react";
import { StageDot } from "../data/StageDot.jsx";
import { ProgressBar } from "../data/ProgressBar.jsx";

const STAGES = { new: "var(--stage-new)", negotiation: "var(--stage-negotiation)", won: "var(--stage-won)", lost: "var(--stage-lost)" };

export function FunnelBreakdown({ stages = [], max, className = "", style }) {
  const h = React.createElement;
  const m = max || Math.max(1, ...stages.map((s) => s.count || 0));
  return h("div", { className: ("bk-funnel " + className).trim(), style },
    stages.map((s) => {
      const c = s.color || STAGES[s.stage] || STAGES.new;
      return h("div", { key: s.label, className: "bk-funnel__row" },
        h(StageDot, { color: c, label: s.label }),
        h(ProgressBar, { value: s.count || 0, max: m, color: c, size: "sm" }),
        h("span", { className: "bk-funnel__count" }, s.count),
        h("span", { className: "bk-funnel__value" }, s.value));
    }));
}

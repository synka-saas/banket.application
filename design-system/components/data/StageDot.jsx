import React from "react";

const STAGES = { new: "var(--stage-new)", negotiation: "var(--stage-negotiation)", won: "var(--stage-won)", lost: "var(--stage-lost)" };

export function StageDot({ stage = "new", color, label, className = "", style }) {
  const c = color || STAGES[stage] || stage;
  return React.createElement("span", { className: ("bk-stage " + className).trim(), style },
    React.createElement("span", { className: "bk-stage__dot", style: { background: c } }), label);
}

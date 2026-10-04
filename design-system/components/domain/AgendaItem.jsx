import React from "react";
import { StageDot } from "../data/StageDot.jsx";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const STAGES = { new: "var(--stage-new)", negotiation: "var(--stage-negotiation)", won: "var(--stage-won)", lost: "var(--stage-lost)" };

export function AgendaItem({ date, title, meta, stage, stageLabel, color, onClick, className = "", style }) {
  const h = React.createElement;
  const parts = (date || "").split("-");
  const day = parts[2] || "";
  const mon = parts[1] ? MONTHS[parseInt(parts[1], 10) - 1] : "";
  return h("div", { className: ("bk-agenda-item " + className).trim(), style, onClick, role: onClick ? "button" : undefined, tabIndex: onClick ? 0 : undefined },
    h("div", { className: "bk-agenda-item__date" }, h("span", { className: "bk-agenda-item__day" }, day), h("span", { className: "bk-agenda-item__mon" }, mon)),
    h("div", { className: "bk-agenda-item__main" },
      h("div", { className: "bk-agenda-item__title" }, title),
      meta ? h("div", { className: "bk-agenda-item__meta" }, meta) : null),
    stageLabel ? h("div", { style: { flex: "none", fontSize: "var(--fs-13)" } }, h(StageDot, { color: color || STAGES[stage], label: stageLabel })) : null);
}

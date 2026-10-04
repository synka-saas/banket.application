import React from "react";
import { StageDot } from "../data/StageDot.jsx";

const STAGES = { new: "var(--stage-new)", negotiation: "var(--stage-negotiation)", won: "var(--stage-won)", lost: "var(--stage-lost)" };

export function KanbanColumn({ title, stage = "new", color, count = 0, total, emptyLabel = "Nenhum evento", children, className = "", style }) {
  const h = React.createElement;
  const c = color || STAGES[stage];
  const n = React.Children.count(children);
  const countLabel = String(count).padStart(2, "0") + (count === 1 ? " evento" : " eventos");
  return h("section", { className: ("bk-kcol " + className).trim(), style: { "--_stage": c, ...style } },
    h("header", { className: "bk-kcol__head" },
      h("div", { className: "bk-kcol__row" }, h("span", { className: "bk-kcol__title" }, h(StageDot, { color: c, label: title }))),
      h("div", { className: "bk-kcol__row" },
        h("span", { className: "bk-kcol__meta" }, countLabel),
        total != null ? h("span", { className: "bk-kcol__total" }, total) : null)),
    h("div", { className: "bk-kcol__list" }, n ? children : h("div", { className: "bk-kcol__empty" }, emptyLabel)));
}

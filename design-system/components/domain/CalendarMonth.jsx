import React from "react";

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const STAGES = { new: "var(--stage-new)", negotiation: "var(--stage-negotiation)", won: "var(--stage-won)", lost: "var(--stage-lost)" };
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

export function CalendarMonth({ year, month, events = [], today, maxPerDay = 3, onDayClick, onEventClick, className = "", style }) {
  const h = React.createElement;
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const last = new Date(year, month + 1, 0);
  const weeks = Math.ceil((first.getDay() + last.getDate()) / 7);
  const todayIso = today || iso(new Date());
  const byDay = {};
  events.forEach((e) => { (byDay[e.date] = byDay[e.date] || []).push(e); });
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = iso(d);
    const list = (byDay[key] || []).slice().sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    const out = d.getMonth() !== month;
    const wk = d.getDay() === 0 || d.getDay() === 6;
    cells.push(h("div", { key, className: ["bk-cal__cell", out ? "bk-cal__cell--out" : "", wk ? "bk-cal__cell--weekend" : "", key === todayIso ? "bk-cal__cell--today" : ""].filter(Boolean).join(" "), onClick: () => onDayClick && onDayClick(key) },
      h("span", { className: "bk-cal__num" }, d.getDate()),
      list.slice(0, maxPerDay).map((e, j) => h("button", { key: j, type: "button", className: "bk-chip-evt", title: (e.time ? e.time + " " : "") + e.title, style: { "--_stage": e.color || STAGES[e.stage] || STAGES.negotiation }, onClick: (ev) => { ev.stopPropagation(); onEventClick && onEventClick(e); } },
        h("span", { className: "bk-chip-evt__bar" }),
        e.time ? h("span", { className: "bk-chip-evt__time" }, e.time) : null,
        h("span", { className: "bk-chip-evt__title" }, e.title))),
      list.length > maxPerDay ? h("span", { className: "bk-cal__more" }, "+" + (list.length - maxPerDay) + " mais") : null));
  }
  return h("div", { className: ("bk-cal " + className).trim(), style },
    h("div", { className: "bk-cal__dow" }, DOW.map((d) => h("span", { key: d }, d))),
    h("div", { className: "bk-cal__grid" }, cells));
}

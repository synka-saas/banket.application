import React from "react";
import { Icon } from "../core/Icon.jsx";
import { Button } from "../core/Button.jsx";
import { Switch } from "../forms/Switch.jsx";
import { Checkbox } from "../forms/Checkbox.jsx";
import { Tag } from "../data/Tag.jsx";
import { ReorderControls } from "./ReorderControls.jsx";

export function FormSection({ index, title, description, badge, active = true, alwaysActive = false, onToggleActive, questions = [], onAddQuestion, onQuestionChange, className = "", style }) {
  const h = React.createElement;
  return h("section", { className: ["bk-fsec", !active ? "bk-fsec--off" : "", className].filter(Boolean).join(" "), style },
    h("header", { className: "bk-fsec__head" },
      h("span", { className: "bk-fsec__num" }, index),
      h("div", { className: "bk-fsec__titles" }, h("h3", { className: "bk-fsec__title" }, title), description ? h("div", { className: "bk-fsec__desc" }, description) : null),
      h("div", { className: "bk-fsec__aside" },
        badge ? h(Tag, { caps: true, size: "sm", tone: "accent" }, badge) : null,
        alwaysActive
          ? h("span", { className: "bk-fsec__lock" }, h(Icon, { name: "lock", size: 13, stroke: 1.75 }), "Sempre ativa")
          : h(Switch, { size: "sm", label: "Seção ativa", checked: active, onChange: (e) => onToggleActive && onToggleActive(e.target.checked) }))),
    questions.map((q, i) => h("div", { key: q.label + i, className: "bk-fsec__q" },
      h(ReorderControls, { grip: false, canUp: i > 0, canDown: i < questions.length - 1 }),
      h("div", { className: "bk-fsec__qmain" },
        h("div", { className: "bk-fsec__qlabel" }, q.label, q.required ? h("span", { className: "bk-field__req" }, "*") : null),
        h("div", { className: "bk-fsec__qtype" }, q.type)),
      h("div", { className: "bk-fsec__qaside" },
        q.locked
          ? h("span", { className: "bk-fsec__lock" }, h(Icon, { name: "lock", size: 13, stroke: 1.75 }), "Obrigatória")
          : [h(Checkbox, { key: "c", size: "sm", label: "Obrigatória", defaultChecked: q.required, onChange: (e) => onQuestionChange && onQuestionChange(i, { required: e.target.checked }) }),
             h(Switch, { key: "s", size: "sm", defaultChecked: q.enabled !== false, "aria-label": "Pergunta ativa", onChange: (e) => onQuestionChange && onQuestionChange(i, { enabled: e.target.checked }) })]))),
    h("div", { className: "bk-fsec__add" }, h(Button, { variant: "text", tone: "accent", size: "sm", icon: "circle-plus", onClick: onAddQuestion }, "Adicionar pergunta")));
}

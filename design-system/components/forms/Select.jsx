import React from "react";
import { Icon } from "../core/Icon.jsx";

export function Select({ options = [], placeholder, value, defaultValue, onChange, icon, size = "md", invalid = false, disabled = false, className = "", style, ...rest }) {
  const isEmpty = (value !== undefined ? value : defaultValue) === "" || (value === undefined && defaultValue === undefined && placeholder);
  const cls = ["bk-control", size !== "md" ? "bk-control--" + size : "", invalid ? "bk-control--invalid" : "", disabled ? "bk-control--disabled" : "", className].filter(Boolean).join(" ");
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return React.createElement("div", { className: cls, style },
    icon ? React.createElement("span", { className: "bk-control__icon" }, React.createElement(Icon, { name: icon, size: 16, stroke: 1.75 })) : null,
    React.createElement("select", {
      className: "bk-control__input bk-select" + (isEmpty ? " bk-select--placeholder" : ""), value, defaultValue: value === undefined ? (defaultValue !== undefined ? defaultValue : placeholder ? "" : undefined) : undefined,
      onChange, disabled, ...rest,
    },
      placeholder ? React.createElement("option", { value: "", disabled: true }, placeholder) : null,
      opts.map((o) => React.createElement("option", { key: o.value, value: o.value }, o.label))),
    React.createElement("span", { className: "bk-select__chev" }, React.createElement(Icon, { name: "chevron-down", size: 16, stroke: 1.75 })));
}

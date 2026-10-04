import React from "react";
import { Icon } from "../core/Icon.jsx";

export function TextInput({ icon, prefix, suffix, addonEnd, size = "md", invalid = false, disabled = false, className = "", style, inputRef, ...rest }) {
  const cls = ["bk-control", size !== "md" ? "bk-control--" + size : "", invalid ? "bk-control--invalid" : "", disabled ? "bk-control--disabled" : "", className].filter(Boolean).join(" ");
  return React.createElement("div", { className: cls, style },
    prefix ? React.createElement("span", { className: "bk-control__addon" }, prefix) : null,
    icon ? React.createElement("span", { className: "bk-control__icon" }, React.createElement(Icon, { name: icon, size: 16, stroke: 1.75 })) : null,
    React.createElement("input", { className: "bk-control__input", disabled, "aria-invalid": invalid || undefined, ref: inputRef, ...rest }),
    suffix ? React.createElement("span", { className: "bk-control__suffix" }, suffix) : null,
    addonEnd ? React.createElement("span", { className: "bk-control__addon bk-control__addon--end" }, addonEnd) : null);
}

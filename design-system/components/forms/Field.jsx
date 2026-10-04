import React from "react";
import { Icon } from "../core/Icon.jsx";

export function Field({ label, required = false, optional = false, hint, error, htmlFor, children, className = "", style }) {
  return React.createElement("div", { className: ("bk-field " + className).trim(), style },
    label ? React.createElement("label", { className: "bk-field__label", htmlFor },
      label,
      required ? React.createElement("span", { className: "bk-field__req", "aria-hidden": true }, "*") : null,
      optional ? React.createElement("span", { className: "bk-field__opt" }, "(opcional)") : null) : null,
    children,
    error ? React.createElement("div", { className: "bk-field__error", role: "alert" }, React.createElement(Icon, { name: "alert-circle", size: 14, stroke: 1.75 }), error)
      : hint ? React.createElement("div", { className: "bk-field__hint" }, hint) : null);
}

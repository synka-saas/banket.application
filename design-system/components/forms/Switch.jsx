import React from "react";

export function Switch({ label, checked, defaultChecked, onChange, disabled = false, size = "md", className = "", ...rest }) {
  const cls = ["bk-switch", size === "sm" ? "bk-switch--sm" : "", disabled ? "bk-switch--disabled" : "", className].filter(Boolean).join(" ");
  return React.createElement("label", { className: cls },
    React.createElement("input", { type: "checkbox", role: "switch", className: "bk-check__input bk-switch__input", checked, defaultChecked, onChange, disabled, ...rest }),
    React.createElement("span", { className: "bk-switch__track" }, React.createElement("span", { className: "bk-switch__thumb" })),
    label != null ? React.createElement("span", null, label) : null);
}

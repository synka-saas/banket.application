import React from "react";

export function Textarea({ rows = 4, invalid = false, disabled = false, className = "", style, ...rest }) {
  const cls = ["bk-control", "bk-textarea", invalid ? "bk-control--invalid" : "", disabled ? "bk-control--disabled" : "", className].filter(Boolean).join(" ");
  return React.createElement("div", { className: cls, style },
    React.createElement("textarea", { className: "bk-control__input", rows, disabled, ...rest }));
}

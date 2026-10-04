import React from "react";
import { Icon } from "../core/Icon.jsx";

export function Checkbox({ label, checked, defaultChecked, onChange, indeterminate = false, disabled = false, size = "md", className = "", ...rest }) {
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  const cls = ["bk-check", size === "sm" ? "bk-check--sm" : "", disabled ? "bk-check--disabled" : "", className].filter(Boolean).join(" ");
  return React.createElement("label", { className: cls },
    React.createElement("input", { ref, type: "checkbox", className: "bk-check__input", checked, defaultChecked, onChange, disabled, ...rest }),
    React.createElement("span", { className: "bk-check__box" }, React.createElement(Icon, { name: indeterminate ? "minus" : "check", size: size === "sm" ? 12 : 13, stroke: 2.5 })),
    label != null ? React.createElement("span", null, label) : null);
}

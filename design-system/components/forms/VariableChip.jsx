import React from "react";

export function VariableChip({ children, onClick, className = "", ...rest }) {
  return React.createElement("button", { type: "button", className: ("bk-varchip " + className).trim(), onClick, ...rest }, children);
}

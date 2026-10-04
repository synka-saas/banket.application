import React from "react";
import { TextInput } from "./TextInput.jsx";

export function ColorInput({ value, defaultValue = "#E35336", onChange, disabled = false, className = "", style }) {
  const [inner, setInner] = React.useState(value !== undefined ? value : defaultValue);
  const v = value !== undefined ? value : inner;
  const set = (nv) => { if (value === undefined) setInner(nv); if (onChange) onChange(nv); };
  return React.createElement("div", { className: ("bk-color " + className).trim(), style },
    React.createElement("label", { className: "bk-color__swatch", style: { background: v } },
      React.createElement("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000", onChange: (e) => set(e.target.value.toUpperCase()), disabled })),
    React.createElement(TextInput, { value: v, onChange: (e) => set(e.target.value), disabled, maxLength: 7, spellCheck: false }));
}

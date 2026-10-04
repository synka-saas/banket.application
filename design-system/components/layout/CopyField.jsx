import React from "react";
import { Icon } from "../core/Icon.jsx";
import { Button } from "../core/Button.jsx";

export function CopyField({ url, onCopy, onShare, copyLabel = "Copiar link", shareLabel = "Compartilhar", className = "", style }) {
  const h = React.createElement;
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    try { navigator.clipboard && navigator.clipboard.writeText(url); } catch (e) {}
    setCopied(true); setTimeout(() => setCopied(false), 1600);
    if (onCopy) onCopy(url);
  };
  return h("div", { className: ("bk-copy " + className).trim(), style },
    h("span", { className: "bk-copy__icon" }, h(Icon, { name: "link", size: 16, stroke: 1.75 })),
    h("span", { className: "bk-copy__url", title: url }, url),
    h("span", { className: "bk-copy__actions" },
      h(Button, { variant: "text", size: "sm", tone: "accent", icon: copied ? "check" : "copy", onClick: copy }, copied ? "Copiado" : copyLabel),
      onShare ? h(Button, { variant: "text", size: "sm", tone: "accent", icon: "share", onClick: onShare }, shareLabel) : null));
}

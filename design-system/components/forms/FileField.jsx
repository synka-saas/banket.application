import React from "react";
import { Icon } from "../core/Icon.jsx";
import { Button } from "../core/Button.jsx";

export function FileField({ name, status = "Salvo", thumbnail, onReplace, onRemove, onUpload, emptyLabel = "Enviar arquivo", emptyHint = "PNG, JPG ou SVG · até 5 MB", className = "", style }) {
  if (!name) {
    return React.createElement("div", { className: ("bk-file bk-file--empty " + className).trim(), style, onClick: onUpload, role: "button", tabIndex: 0 },
      React.createElement(Icon, { name: "upload", size: 22, color: "var(--terracotta-600)" }),
      React.createElement("div", { className: "bk-file__name" }, emptyLabel),
      React.createElement("div", { className: "bk-file__status" }, emptyHint));
  }
  return React.createElement("div", { className: ("bk-file " + className).trim(), style },
    React.createElement("div", { className: "bk-file__thumb" }, thumbnail ? React.createElement("img", { src: thumbnail, alt: "" }) : React.createElement(Icon, { name: "photo", size: 20 })),
    React.createElement("div", { className: "bk-file__meta" },
      React.createElement("div", { className: "bk-file__name" }, name),
      React.createElement("div", { className: "bk-file__status" }, React.createElement(Icon, { name: "circle-check", size: 13, stroke: 1.75, color: "var(--success)" }), status)),
    React.createElement("div", { className: "bk-file__actions" },
      React.createElement(Button, { variant: "text", size: "sm", icon: "arrows-exchange", onClick: onReplace }, "Trocar"),
      React.createElement(Button, { variant: "text", tone: "danger", size: "sm", icon: "trash", onClick: onRemove }, "Remover")));
}

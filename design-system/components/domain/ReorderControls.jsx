import React from "react";
import { Icon } from "../core/Icon.jsx";
import { IconButton } from "../core/IconButton.jsx";

export function ReorderControls({ canUp = true, canDown = true, onUp, onDown, grip = true, className = "", style }) {
  const h = React.createElement;
  return h("div", { className: ("bk-reorder " + className).trim(), style },
    grip ? h("span", { className: "bk-reorder__grip", "aria-hidden": true }, h(Icon, { name: "grip-vertical", size: 16, stroke: 1.75 })) : null,
    h(IconButton, { icon: "chevron-up", label: "Mover para cima", size: "xs", variant: "secondary", disabled: !canUp, onClick: onUp }),
    h(IconButton, { icon: "chevron-down", label: "Mover para baixo", size: "xs", variant: "secondary", disabled: !canDown, onClick: onDown }));
}

import React from "react";
import { Avatar } from "../core/Avatar.jsx";
import { Icon } from "../core/Icon.jsx";
import { Menu } from "../overlay/Menu.jsx";

export function UserMenu({ name, role, avatar, items, onClick, className = "" }) {
  const h = React.createElement;
  const trigger = h("button", { type: "button", className: ("bk-usermenu " + className).trim(), onClick },
    h(Avatar, { name, src: avatar }),
    h("span", { className: "bk-usermenu__text" },
      h("span", { className: "bk-usermenu__name" }, name),
      role ? h("span", { className: "bk-usermenu__role" }, role) : null),
    h(Icon, { name: "chevron-down", size: 16, stroke: 1.75 }));
  if (!items || !items.length) return trigger;
  return h(Menu, { trigger, items, align: "end" });
}

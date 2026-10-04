import React from "react";
import { Icon } from "../core/Icon.jsx";
import { IconButton } from "../core/IconButton.jsx";
import { Menu } from "../overlay/Menu.jsx";
import { InfoList } from "../data/InfoList.jsx";
import { Tag } from "../data/Tag.jsx";

export function EventCard({ title, client, kind = "person", rows = [], eventType, timeInStage, menuItems, onClick, className = "", style }) {
  const h = React.createElement;
  const typeTone = eventType === "Corporativo" ? "cobalt" : eventType === "Religioso" ? "ochre" : "neutral";
  return h("article", { className: ("bk-ecard " + className).trim(), style, onClick },
    h("div", { className: "bk-ecard__top" },
      h("span", { className: "bk-ecard__icon" }, h(Icon, { name: kind === "company" ? "building" : "user-square", size: 16, stroke: 1.75 })),
      h("div", { className: "bk-ecard__titles" },
        h("h4", { className: "bk-ecard__title", title }, title),
        client ? h("div", { className: "bk-ecard__client" }, client) : null),
      menuItems && menuItems.length ? h("div", { onClick: (e) => e.stopPropagation() },
        h(Menu, { trigger: h(IconButton, { icon: "dots", label: "Mais ações", size: "xs" }), items: menuItems })) : null),
    rows.length ? h(InfoList, { size: "sm", items: rows }) : null,
    eventType || timeInStage ? h("div", { className: "bk-ecard__tags" },
      eventType ? h(Tag, { tone: typeTone, size: "sm" }, eventType) : null,
      timeInStage ? h(Tag, { tone: "accent", size: "sm", icon: "clock" }, timeInStage) : null) : null);
}

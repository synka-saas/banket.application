import * as React from "react";

export type IconName =
  | "layout-dashboard" | "layout-kanban" | "tools-kitchen-2" | "user-square" | "calendar" | "stack-2" | "users" | "file-text" | "settings" | "headset"
  | "search" | "filter" | "download" | "upload" | "file-import" | "circle-plus" | "plus" | "minus" | "list" | "list-details"
  | "chevron-down" | "chevron-up" | "chevron-left" | "chevron-right" | "selector" | "dots" | "dots-vertical" | "x" | "pencil" | "trash"
  | "arrows-exchange" | "copy" | "share" | "eye" | "external-link" | "check" | "link" | "arrow-left" | "arrow-right" | "grip-vertical"
  | "logout" | "menu-2" | "refresh" | "alert-circle" | "alert-triangle" | "info-circle" | "circle-check" | "lock" | "bell" | "clock"
  | "calendar-event" | "building" | "send" | "soup" | "salad" | "chef-hat" | "glass-full" | "cake" | "users-group" | "map-pin"
  | "mail" | "phone" | "brand-whatsapp" | "coin" | "receipt" | "tag" | "sparkles" | "photo" | "palette" | "signature" | "chart-bar"
  | "table" | "layout-grid" | "adjustments-horizontal" | "user" | "user-plus" | "briefcase" | "confetti" | "heart" | "file-dollar"
  | "printer" | "star" | "clipboard-list" | "layout-sidebar-left-collapse" | "home" | "sort-descending-2";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** Tabler outline icon name (see ICON_NAMES for the full list shipped). */
  name: IconName | string;
  /** Pixel size. 16 inline/small controls, 18 default UI, 20 nav, 24 empty states. */
  size?: number;
  /** Stroke width. Banket uses 1.5 (refined) — 1.75 for ≤14px icons. */
  stroke?: number;
  /** Override color; defaults to currentColor. */
  color?: string;
  /** Accessible label; omit for decorative icons. */
  title?: string;
}

export function Icon(props: IconProps): JSX.Element;
export const ICON_NAMES: string[];

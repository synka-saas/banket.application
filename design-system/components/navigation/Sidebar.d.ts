export interface SidebarItem {
  key: string;
  label: string;
  /** Tabler icon name. */
  icon: string;
  href?: string;
  count?: number;
}
export interface SidebarGroup { group: string }

/**
 * App sidebar: logo on top, warm-tinted nav column, active item = white tile + terracotta label.
 */
export interface SidebarProps {
  /** Defaults to BANKET_NAV (Dashboard … Suporte). Insert {group:"…"} entries for section labels. */
  items?: Array<SidebarItem | SidebarGroup>;
  activeKey?: string;
  onSelect?: (key: string) => void;
  /** Replace the logo. */
  brand?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Sidebar(props: SidebarProps): JSX.Element;
export const BANKET_NAV: SidebarItem[];

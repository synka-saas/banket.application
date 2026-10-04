export interface MenuItem {
  label?: React.ReactNode;
  icon?: string;
  onClick?: () => void;
  /** Wine-tinted destructive item (Excluir). */
  danger?: boolean;
  disabled?: boolean;
  /** Right-aligned hint (shortcut, count). */
  hint?: React.ReactNode;
  /** Render a hairline separator instead of an item. */
  divider?: boolean;
  /** Render an uppercase section label instead of an item. */
  section?: string;
}

export interface MenuProps {
  /** The element that toggles the menu (IconButton "dots", UserMenu…). */
  trigger: React.ReactElement;
  items: MenuItem[];
  /** Popover alignment relative to the trigger. */
  align?: "start" | "end";
  defaultOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Menu(props: MenuProps): JSX.Element;

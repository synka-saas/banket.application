export interface TabItem { key: string; label: React.ReactNode; count?: number }

export interface TabsProps {
  items: Array<TabItem | string>;
  activeKey: string;
  onChange?: (key: string) => void;
  /** inline = no white bar / side padding (inside cards or drawers). Default is the full-width sub-nav bar under AppHeader. */
  inline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Tabs(props: TabsProps): JSX.Element;

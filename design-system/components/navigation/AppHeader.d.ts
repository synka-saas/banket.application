export interface Crumb { label: string; onClick?: () => void }

export interface AppHeaderProps {
  /** Page title (single level). */
  title?: React.ReactNode;
  /** Multi-level title: ["Cardápios", "Categorias"] → "Cardápios / Categorias", parents muted and clickable. */
  breadcrumb?: Array<Crumb | string>;
  /** Extra header actions (rare — page actions belong in the Toolbar). */
  actions?: React.ReactNode;
  /** Usually <UserMenu/>. */
  user?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function AppHeader(props: AppHeaderProps): JSX.Element;

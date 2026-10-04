/**
 * Rounded white surface with optional icon tile, title, description, header actions and footer.
 * @startingPoint section="Layout" subtitle="Section card with icon header, collapsible variant" viewport="700x360"
 */
export interface CardProps {
  title?: React.ReactNode;
  /** Tabler icon shown in a terracotta-50 tile. */
  icon?: string;
  description?: React.ReactNode;
  /** Header-right slot (buttons, switches, badges). */
  actions?: React.ReactNode;
  /** Footer bar (clay-25 strip) — right-aligned buttons. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /** outlined (default) · subtle (clay-25, no shadow) · elevated (shadow-md). */
  variant?: "outlined" | "subtle" | "elevated";
  /** md = 24px sides · sm = 16px (kanban / catalog cards) · none = flush body (tables, lists). */
  padding?: "md" | "sm" | "none";
  /** Hairline under the header. */
  divided?: boolean;
  /** Header toggles the body (template editor sections). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Hover lift for clickable cards. */
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function Card(props: CardProps): JSX.Element;

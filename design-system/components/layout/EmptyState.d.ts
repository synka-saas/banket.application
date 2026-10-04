export interface EmptyStateProps {
  /** Tabler icon in a terracotta-50 tile ("headset", "calendar", "users"…). */
  icon?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Usually a primary Button. */
  action?: React.ReactNode;
  /** Smaller variant for inside cards/columns. */
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function EmptyState(props: EmptyStateProps): JSX.Element;

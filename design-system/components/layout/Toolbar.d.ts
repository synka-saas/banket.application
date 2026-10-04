export interface ToolbarProps {
  /** Left side: search input + filter selects. */
  start?: React.ReactNode;
  /** Right side: secondary actions then the primary "Novo …" button. */
  end?: React.ReactNode;
  /** Alias for start. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Toolbar(props: ToolbarProps): JSX.Element;

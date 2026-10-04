export interface CopyFieldProps {
  /** The public URL (truncated with ellipsis). */
  url: string;
  onCopy?: (url: string) => void;
  /** Shows a "Compartilhar" action when set. */
  onShare?: () => void;
  copyLabel?: string;
  shareLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CopyField(props: CopyFieldProps): JSX.Element;

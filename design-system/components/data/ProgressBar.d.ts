export interface ProgressBarProps {
  value: number;
  max?: number;
  /** Fill color — use stage tokens: var(--stage-negotiation), var(--stage-won)… */
  color?: string;
  /** sm 6px · md 8px · lg 10px */
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ProgressBar(props: ProgressBarProps): JSX.Element;

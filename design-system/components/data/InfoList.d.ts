export interface InfoListItem { label: React.ReactNode; value?: React.ReactNode }

export interface InfoListProps {
  /** Label/value pairs. Empty values ("", "-", null) render as a soft em-dash. */
  items: InfoListItem[];
  size?: "sm" | "md";
  className?: string;
  style?: React.CSSProperties;
}

export function InfoList(props: InfoListProps): JSX.Element;

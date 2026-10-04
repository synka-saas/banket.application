export interface AgendaItemProps {
  /** ISO date "2026-10-29" → date tile "29 out". */
  date: string;
  title: React.ReactNode;
  /** "Quinta-feira · 11:00 · 50 convidados". */
  meta?: React.ReactNode;
  stage?: "new" | "negotiation" | "won" | "lost";
  stageLabel?: string;
  color?: string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function AgendaItem(props: AgendaItemProps): JSX.Element;

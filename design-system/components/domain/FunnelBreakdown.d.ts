export interface FunnelStageRow {
  label: string;
  stage?: "new" | "negotiation" | "won" | "lost";
  color?: string;
  count: number;
  /** Money for the stage: "R$ 179.205,00". */
  value?: React.ReactNode;
}

export interface FunnelBreakdownProps {
  stages: FunnelStageRow[];
  /** Scale max for bars; defaults to the largest count. */
  max?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function FunnelBreakdown(props: FunnelBreakdownProps): JSX.Element;

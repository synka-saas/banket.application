export interface StageDotProps {
  /** Funnel stage function: new (Novo orçamento) · negotiation (Em negociação) · won (Aprovado) · lost (Recusado). */
  stage?: "new" | "negotiation" | "won" | "lost";
  /** Custom stage color (tenants can create their own stages). */
  color?: string;
  label?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function StageDot(props: StageDotProps): JSX.Element;

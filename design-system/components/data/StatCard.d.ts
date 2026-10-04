/**
 * KPI tile for the dashboard row (Pedidos recebidos, Em aberto, Aprovados, Taxa de conversão, Ticket médio).
 */
export interface StatCardProps {
  /** Short uppercase eyebrow label. */
  label: React.ReactNode;
  /** The figure: "16", "R$ 179.205,00", "100%". */
  value: React.ReactNode;
  /** Context line: "últimos 90 dias", "15 eventos no funil". */
  hint?: React.ReactNode;
  /** success tints the value sage (approved money); accent tints terracotta. */
  tone?: "default" | "success" | "accent";
  icon?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function StatCard(props: StatCardProps): JSX.Element;

export interface KanbanColumnProps {
  /** Stage name: "Novo orçamento", "Em negociação", "Aprovado", "Recusado". */
  title: string;
  /** Stage function — sets the top accent + dot color. */
  stage?: "new" | "negotiation" | "won" | "lost";
  /** Custom stage color. */
  color?: string;
  /** Number of events (rendered zero-padded: "05 eventos"). */
  count?: number;
  /** Sum of the column: "R$ 171.300,00". */
  total?: React.ReactNode;
  emptyLabel?: string;
  /** EventCard children. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function KanbanColumn(props: KanbanColumnProps): JSX.Element;

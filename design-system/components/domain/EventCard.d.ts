import type { MenuItem } from "../overlay/Menu";
import type { InfoListItem } from "../data/InfoList";

/**
 * Kanban card for an event in the Funil de vendas.
 * @startingPoint section="Domain" subtitle="Funil de vendas — kanban, agenda, catálogo e formulários" viewport="700x1100"
 */
export interface EventCardProps {
  /** Event name: "Degustação", "Casamento", "Confraternização de fim de ano". */
  title: string;
  /** Client name. */
  client?: string;
  /** person → user-square icon; company → building icon. */
  kind?: "person" | "company";
  /** Pessoas, Formato de serviço, Verba estimada / Orçamento, Data. */
  rows?: InfoListItem[];
  /** Tipo de evento: Social (neutral) · Corporativo (cobalt) · Religioso (ochre). */
  eventType?: string;
  /** "há 11 dias nesta etapa". */
  timeInStage?: string;
  /** Overflow "⋯" menu. */
  menuItems?: MenuItem[];
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function EventCard(props: EventCardProps): JSX.Element;

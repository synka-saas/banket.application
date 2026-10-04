import type { InfoListItem } from "../data/InfoList";

/**
 * Grid card for catalog entities: Opções de cardápio, Formulários, Templates de proposta.
 */
export interface CatalogCardProps {
  /** Tabler icon in a terracotta tile: salad (opção de cardápio), stack-2 (formulário), soup / file-text (template). */
  icon?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Preview image URL or node (template cover). */
  media?: string | React.ReactNode;
  /** Preço por pessoa, Duração, Seções, Itens… */
  rows?: InfoListItem[];
  tags?: string[];
  /** Header-right status node, e.g. <StatusBadge status="active"/>. */
  status?: React.ReactNode;
  actionLabel?: string;
  /** Refresh default is secondary — a grid of filled terracotta buttons was visually heavy. */
  actionVariant?: "primary" | "secondary" | "soft";
  onAction?: () => void;
  /** Extra text links under the action (Respostas, Pré-visualizar, Abrir formulário). */
  links?: Array<{ label: string; icon?: string; onClick?: () => void }>;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function CatalogCard(props: CatalogCardProps): JSX.Element;

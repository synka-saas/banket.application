export interface StatusBadgeProps {
  /** Preset: active=Ativo (sage) · inactive=Inativo · pending=Pendente (ochre) · error=Erro · draft=Rascunho · sent=Enviada (cobalt) · open=Aberto (terracotta). */
  status?: "active" | "inactive" | "pending" | "error" | "draft" | "sent" | "open" | string;
  /** Override tone. */
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
  /** Override label. */
  children?: React.ReactNode;
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function StatusBadge(props: StatusBadgeProps): JSX.Element;

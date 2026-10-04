export interface BackLinkProps {
  /** "Todos os formulários", "Voltar para o funil". */
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function BackLink(props: BackLinkProps): JSX.Element;

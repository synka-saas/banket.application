export interface ActionBarProps {
  /** Save state text: "Tudo salvo", "Alterações não salvas". */
  status?: React.ReactNode;
  /** Ochre warning tint + alert icon. */
  dirty?: boolean;
  /** Stick to the bottom of the scroll container (default true). */
  sticky?: boolean;
  /** Right side buttons — secondary actions then one primary "Salvar". */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ActionBar(props: ActionBarProps): JSX.Element;

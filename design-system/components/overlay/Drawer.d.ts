/**
 * Right-side sheet for create/edit flows (Novo cliente, Novo profissional, Novo chamado, editar evento).
 * @startingPoint section="Overlay" subtitle="Right drawer with form fields and Salvar action" viewport="900x560"
 */
export interface DrawerProps {
  open?: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Closes on scrim click, Esc and the X button. */
  onClose?: () => void;
  /** Header-right actions — the primary "Salvar" lives here (matches production). */
  actions?: React.ReactNode;
  /** Optional sticky footer bar (alternative placement for actions on long forms). */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /** Panel width; default var(--drawer-width) = 560px. */
  width?: number | string;
  /** Position absolutely inside the nearest positioned parent instead of the viewport (previews, embedded frames). */
  contained?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Drawer(props: DrawerProps): JSX.Element | null;

export interface FileFieldProps {
  /** Current file label ("Logotipo atual", "Imagem de fundo atual"). Omit to render the empty upload state. */
  name?: string;
  /** Status line under the name. */
  status?: string;
  /** Preview image URL. */
  thumbnail?: string;
  onReplace?: () => void;
  onRemove?: () => void;
  onUpload?: () => void;
  emptyLabel?: string;
  emptyHint?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function FileField(props: FileFieldProps): JSX.Element;

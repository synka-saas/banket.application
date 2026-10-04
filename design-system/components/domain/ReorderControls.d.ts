export interface ReorderControlsProps {
  canUp?: boolean;
  canDown?: boolean;
  onUp?: () => void;
  onDown?: () => void;
  /** Show the drag grip (default true). */
  grip?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ReorderControls(props: ReorderControlsProps): JSX.Element;

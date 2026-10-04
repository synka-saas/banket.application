export interface ColorInputProps {
  /** Hex string "#RRGGBB" (controlled). */
  value?: string;
  defaultValue?: string;
  onChange?: (hex: string) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ColorInput(props: ColorInputProps): JSX.Element;

export interface FieldProps {
  /** Sentence-case label ("Nome / razão social"). */
  label?: React.ReactNode;
  /** Shows a terracotta asterisk. */
  required?: boolean;
  /** Shows "(opcional)" after the label. */
  optional?: boolean;
  /** Helper text below the control. */
  hint?: React.ReactNode;
  /** Error text — replaces hint, tints red. */
  error?: React.ReactNode;
  htmlFor?: string;
  /** The control: TextInput, Select, Textarea, ColorInput… */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Field(props: FieldProps): JSX.Element;

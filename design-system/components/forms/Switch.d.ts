import * as React from "react";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  /** sm for dense table rows (Ocasiões × Tipos de evento). */
  size?: "sm" | "md";
}

export function Switch(props: SwitchProps): JSX.Element;

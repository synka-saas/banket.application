import * as React from "react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  /** sm = 16px box / 13px label (dense rows like the form builder "Obrigatória"). */
  size?: "sm" | "md";
}

export function Checkbox(props: CheckboxProps): JSX.Element;

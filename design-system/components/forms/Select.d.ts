import * as React from "react";

export interface SelectOption { value: string; label: string }

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options: Array<SelectOption | string>;
  /** Shown as a disabled first option when nothing is selected ("Selecione…", "Seção", "Tipo de cliente"). */
  placeholder?: string;
  /** Leading icon, e.g. "filter" for toolbar filters. */
  icon?: string;
  size?: "sm" | "md" | "lg";
  invalid?: boolean;
  disabled?: boolean;
}

export function Select(props: SelectProps): JSX.Element;

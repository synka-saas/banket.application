import * as React from "react";

export interface VariableChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The merge tag text, braces included: "{nome_cliente}". */
  children: React.ReactNode;
}

export function VariableChip(props: VariableChipProps): JSX.Element;

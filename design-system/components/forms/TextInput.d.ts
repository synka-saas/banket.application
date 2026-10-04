import * as React from "react";

export interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  /** Leading Tabler icon (e.g. "search"). */
  icon?: string;
  /** Leading text addon, e.g. "/f/" for public form slugs or "R$". */
  prefix?: React.ReactNode;
  /** Trailing inline text, e.g. "convidados". */
  suffix?: React.ReactNode;
  /** Trailing boxed addon, e.g. "dias". */
  addonEnd?: React.ReactNode;
  /** sm 32 · md 40 · lg 48 */
  size?: "sm" | "md" | "lg";
  invalid?: boolean;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}

export function TextInput(props: TextInputProps): JSX.Element;
